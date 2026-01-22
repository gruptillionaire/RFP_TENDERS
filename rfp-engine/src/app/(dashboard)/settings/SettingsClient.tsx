"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TwoFactorSettings } from "@/components/TwoFactorSettings";
import { ChangePasswordSettings } from "@/components/ChangePasswordSettings";

interface BillingInfo {
  plan: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeAccount: boolean;
  usage: {
    extractionsUsed: number;
    extractionsLimit: number;
    draftsUsed: number;
    draftsLimit: number;
  };
  limits?: {
    canExportWord: boolean;
    canUseLibrary: boolean;
  };
  singleUse?: {
    hasCredits: boolean;
    extractionsRemaining: number;
    draftsRemaining: number;
    expiresAt: string | null;
    isExpired: boolean;
  };
}

interface SettingsClientProps {
  userEmail: string;
  userName: string | null;
  initialCcpaOptOut: boolean;
  billingInfo: BillingInfo;
}

export function SettingsClient({ userEmail, userName, initialCcpaOptOut, billingInfo }: SettingsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [exportStatus, setExportStatus] = useState<"idle" | "pending" | "completed" | "error">("idle");
  const [ccpaOptOut, setCcpaOptOut] = useState(initialCcpaOptOut);

  const handleExportData = async () => {
    setLoading(true);
    setMessage(null);
    setExportStatus("pending");

    try {
      const res = await fetch("/api/user/export", {
        method: "POST",
      });

      if (res.ok) {
        // For immediate download, the API returns the data directly
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rfp-matrix-data-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setExportStatus("completed");
        setMessage({ type: "success", text: "Your data has been exported successfully." });
      } else {
        const data = await res.json();
        setExportStatus("error");
        setMessage({ type: "error", text: data.error || "Failed to export data." });
      }
    } catch {
      setExportStatus("error");
      setMessage({ type: "error", text: "An error occurred while exporting data." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      setMessage({ type: "error", text: "Please type DELETE to confirm." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/delete", {
        method: "POST",
      });

      if (res.ok) {
        setMessage({
          type: "success",
          text: "Account deleted successfully. Redirecting...",
        });
        setShowDeleteConfirm(false);
        // Redirect to login after a delay
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to delete account." });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: "error", text: data.error || "Failed to open billing portal." });
        setPortalLoading(false);
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred." });
      setPortalLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getPlanName = (plan: string) => {
    const names: Record<string, string> = {
      FREE: "No Active Subscription",
      STARTER: "Starter",
      PRO: "Pro",
      BUSINESS: "Business",
      ENTERPRISE: "Enterprise",
    };
    return names[plan] || plan;
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      ACTIVE: "bg-[#dcfce7] text-[#166534]",
      PAST_DUE: "bg-[#fef9c3] text-[#a16207]",
      CANCELED: "bg-slate-100 text-slate-600",
      TRIALING: "bg-[#dbeafe] text-[#1e40af]",
    };
    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${colors[status] || "bg-slate-100 text-slate-600"}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  const handleCCPAOptOut = async (optOut: boolean) => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/ccpa-optout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optOut }),
      });

      if (res.ok) {
        setCcpaOptOut(optOut);
        setMessage({
          type: "success",
          text: optOut
            ? "You have opted out of the sale of your personal information."
            : "You have opted back in.",
        });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to update preference." });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="font-extrabold text-xl text-slate-800 tracking-tight">
            RFP Matrix
          </Link>
          <nav className="flex gap-1">
            <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#0d9488] rounded-lg hover:bg-slate-50 transition-colors">
              Dashboard
            </Link>
            <Link href="/settings" className="px-4 py-2 text-sm font-semibold text-[#0d9488] bg-[#f0fdfa] rounded-lg">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#14b8a6] to-[#0d9488] flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Settings</h1>
            <p className="text-sm text-slate-500">Manage your account and preferences</p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
              message.type === "success"
                ? "bg-[#dcfce7] text-[#166534] border border-[#86efac]"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.type === "success" ? (
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {/* Account Information */}
        <Card className="mb-6 rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#dbeafe] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#1e40af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Account Information</CardTitle>
                <CardDescription className="text-slate-500">Your account details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Email</Label>
              <p className="text-slate-800 font-medium mt-1">{userEmail}</p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Name</Label>
              <p className="text-slate-800 font-medium mt-1">{userName || "Not set"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Security - Password */}
        <div className="mb-6">
          <ChangePasswordSettings />
        </div>

        {/* Security - 2FA */}
        <div className="mb-6">
          <TwoFactorSettings />
        </div>

        {/* Billing & Subscription */}
        <Card className="mb-6 rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#166534]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Billing & Subscription</CardTitle>
                <CardDescription className="text-slate-500">Manage your subscription and payment methods</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Plan */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Current Plan</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {getPlanName(billingInfo.plan)}
                  </span>
                  {billingInfo.subscriptionStatus && getStatusBadge(billingInfo.subscriptionStatus)}
                </div>
                {billingInfo.cancelAtPeriodEnd && (
                  <p className="text-sm text-amber-600 mt-1">
                    Your subscription will end on {formatDate(billingInfo.currentPeriodEnd)}
                  </p>
                )}
              </div>
              {billingInfo.plan === "FREE" ? (
                <Link href="/pricing">
                  <Button>Upgrade Plan</Button>
                </Link>
              ) : (
                <Button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  variant="outline"
                >
                  {portalLoading ? "Loading..." : "Manage Subscription"}
                </Button>
              )}
            </div>

            {/* Usage */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-semibold text-slate-800 mb-4">Usage This Month</h3>
              <div className="space-y-4">
                {/* Extraction Usage */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600 font-medium">Document Extractions</span>
                    <span className="font-bold text-slate-800">
                      {billingInfo.usage.extractionsUsed} / {billingInfo.usage.extractionsLimit === -1 ? "Unlimited" : billingInfo.usage.extractionsLimit}
                    </span>
                  </div>
                  {billingInfo.usage.extractionsLimit !== -1 && (
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          billingInfo.usage.extractionsUsed >= billingInfo.usage.extractionsLimit
                            ? "bg-red-500"
                            : billingInfo.usage.extractionsUsed >= billingInfo.usage.extractionsLimit * 0.8
                            ? "bg-[#fcb400]"
                            : "bg-[#14b8a6]"
                        }`}
                        style={{
                          width: `${Math.min(100, (billingInfo.usage.extractionsUsed / billingInfo.usage.extractionsLimit) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Draft Usage */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600 font-medium">AI Draft Generations</span>
                    <span className="font-bold text-slate-800">
                      {billingInfo.usage.draftsUsed} / {billingInfo.usage.draftsLimit === -1 ? "Unlimited" : billingInfo.usage.draftsLimit}
                    </span>
                  </div>
                  {billingInfo.usage.draftsLimit !== -1 && (
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          billingInfo.usage.draftsUsed >= billingInfo.usage.draftsLimit
                            ? "bg-red-500"
                            : billingInfo.usage.draftsUsed >= billingInfo.usage.draftsLimit * 0.8
                            ? "bg-[#fcb400]"
                            : "bg-[#20c933]"
                        }`}
                        style={{
                          width: `${Math.min(100, (billingInfo.usage.draftsUsed / billingInfo.usage.draftsLimit) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Single-Use Credits */}
            {billingInfo.singleUse && (billingInfo.singleUse.hasCredits || billingInfo.singleUse.extractionsRemaining > 0 || billingInfo.singleUse.draftsRemaining > 0) && (
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Single RFP
                  </span>
                  Credits
                </h3>
                {billingInfo.singleUse.isExpired ? (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-500">Your single-use credits have expired.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600">Extractions Remaining</p>
                        <p className="text-2xl font-bold text-orange-600">{billingInfo.singleUse.extractionsRemaining}</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600">Drafts Remaining</p>
                        <p className="text-2xl font-bold text-orange-600">{billingInfo.singleUse.draftsRemaining}</p>
                      </div>
                    </div>
                    {billingInfo.singleUse.expiresAt && (
                      <p className="text-sm text-gray-500">
                        Expires on {formatDate(billingInfo.singleUse.expiresAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Billing Period */}
            {billingInfo.currentPeriodEnd && !billingInfo.cancelAtPeriodEnd && (
              <div className="border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Next billing date</span>
                  <span className="font-medium">{formatDate(billingInfo.currentPeriodEnd)}</span>
                </div>
              </div>
            )}

            {/* Subscribe prompt for users without subscription */}
            {billingInfo.plan === "FREE" && (
              <div className="border-t pt-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900">Subscribe to unlock RFP Matrix</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Choose a plan to start extracting requirements and generating draft responses.
                  </p>
                  <Link href="/pricing" className="inline-block mt-3">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                      View Plans
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Privacy & Data */}
        <Card className="mb-6 rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f3e8ff] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#7c3aed]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Privacy & Data</CardTitle>
                <CardDescription className="text-slate-500">Manage your data and privacy settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Data Export */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">Export Your Data</h3>
                <p className="text-sm text-gray-500">
                  Download a copy of all your data in JSON format (GDPR Article 20)
                </p>
              </div>
              <Button
                onClick={handleExportData}
                disabled={loading || exportStatus === "pending"}
                variant="outline"
              >
                {exportStatus === "pending" ? "Exporting..." : "Export Data"}
              </Button>
            </div>

            {/* Cookie Preferences */}
            <div className="flex items-start justify-between border-t pt-4">
              <div>
                <h3 className="font-medium">Cookie Preferences</h3>
                <p className="text-sm text-gray-500">
                  Manage which cookies you allow us to use
                </p>
              </div>
              <Button
                onClick={() => {
                  // Clear cookie consent to show the banner again
                  localStorage.removeItem("cookie-consent");
                  window.location.reload();
                }}
                variant="outline"
              >
                Manage Cookies
              </Button>
            </div>

            {/* CCPA Opt-Out */}
            <div className="flex items-start justify-between border-t pt-4">
              <div>
                <h3 className="font-medium">Do Not Sell My Personal Information</h3>
                <p className="text-sm text-gray-500">
                  California residents can opt out of the sale of their personal information (CCPA)
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Note: We do not sell personal information, but provide this option for compliance.
                </p>
              </div>
              <Button
                onClick={() => handleCCPAOptOut(!ccpaOptOut)}
                disabled={loading}
                variant={ccpaOptOut ? "default" : "outline"}
              >
                {ccpaOptOut ? "Opted Out" : "Opt Out"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Legal Documents */}
        <Card className="mb-6 rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Legal</CardTitle>
                <CardDescription className="text-slate-500">View our policies and agreements</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/terms"
                className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <svg className="w-4 h-4 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-slate-700 font-medium">Terms of Service</span>
              </Link>
              <Link
                href="/privacy"
                className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <svg className="w-4 h-4 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-slate-700 font-medium">Privacy Policy</span>
              </Link>
              <Link
                href="/cookies"
                className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <svg className="w-4 h-4 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-slate-700 font-medium">Cookie Policy</span>
              </Link>
              <Link
                href="/ccpa"
                className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <svg className="w-4 h-4 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-slate-700 font-medium">California Privacy Rights</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Help & Support */}
        <Card className="mb-6 rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#fef9c3] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#a16207]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Help & Support</CardTitle>
                <CardDescription className="text-slate-500">Get help with your account</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-600">
                Have a question or need assistance? We&apos;re here to help.
              </p>
              <a
                href="mailto:help@rfpmatrix.com"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#0d9488] bg-[#f0fdfa] rounded-lg hover:bg-[#ccfbf1] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Support
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="rounded-xl border-red-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-red-600">Danger Zone</CardTitle>
                <CardDescription className="text-slate-500">Irreversible account actions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!showDeleteConfirm ? (
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-red-600">Delete Account</h3>
                  <p className="text-sm text-gray-500">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="destructive"
                >
                  Delete Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4 p-4 border border-red-200 rounded-lg bg-red-50">
                <p className="font-medium text-red-800">
                  Are you sure you want to delete your account?
                </p>
                <p className="text-sm text-red-700">
                  This will permanently delete:
                </p>
                <ul className="text-sm text-red-700 list-disc list-inside">
                  <li>Your profile information</li>
                  <li>All your projects and RFP documents</li>
                  <li>All requirements and draft responses</li>
                  <li>All associated data</li>
                </ul>
                <div className="space-y-2">
                  <Label htmlFor="deleteConfirm" className="text-red-800">
                    Type DELETE to confirm
                  </Label>
                  <Input
                    id="deleteConfirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="border-red-300"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDeleteAccount}
                    disabled={loading || deleteConfirmText !== "DELETE"}
                    variant="destructive"
                  >
                    {loading ? "Deleting..." : "Confirm Delete"}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText("");
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
