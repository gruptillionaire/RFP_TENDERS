"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

// Plan hierarchy for determining upgrades
const PLAN_HIERARCHY = ["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"];

// Single-use one-time purchase
const singleUsePlan = {
  id: "SINGLE_USE",
  name: "Single RFP",
  price: 100,
  period: "one-time",
  description: "Perfect for a single RFP project",
  features: [
    "1 RFP extraction",
    "100 AI draft responses",
    "150 page limit per upload",
    "Export to Word & PDF",
    "30-day project access",
  ],
  limitations: [
    "No response library",
    "Project expires after 30 days",
  ],
  cta: "Buy Now",
};

// Subscription plans
const plans = [
  {
    id: "STARTER",
    name: "Starter",
    price: 150,
    period: "/month",
    description: "For freelancers and individual consultants",
    features: [
      "2 RFPs per month",
      "200 AI draft responses per month",
      "150 page limit per upload",
      "AI-powered requirement detection",
      "Export to Word & PDF",
    ],
    limitations: [
      "No response library",
    ],
    popular: false,
    isEnterprise: false,
  },
  {
    id: "PRO",
    name: "Pro",
    price: 250,
    period: "/month",
    description: "For SMEs and growing businesses",
    features: [
      "10 RFPs per month",
      "600 AI draft responses per month",
      "200 page limit per upload",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word & PDF",
    ],
    limitations: [],
    popular: true,
    isEnterprise: false,
  },
  {
    id: "BUSINESS",
    name: "Business",
    price: 500,
    period: "/month",
    description: "For agencies and high-volume users",
    features: [
      "Unlimited RFPs",
      "600 AI draft responses per month",
      "No page limit",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word & PDF",
      "Priority support",
    ],
    limitations: [],
    popular: false,
    isEnterprise: false,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 0,
    period: "",
    description: "For large organizations with custom needs",
    features: [
      "Unlimited RFPs",
      "Unlimited AI draft responses",
      "No page limit",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word & PDF",
      "Priority support",
      "Dedicated account manager",
    ],
    limitations: [],
    popular: false,
    isEnterprise: true,
  },
];

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string>("FREE");
  const [planLoading, setPlanLoading] = useState(true);
  const [loadingBilling, setLoadingBilling] = useState(false);

  const cancelled = searchParams.get("subscription") === "cancelled";
  const purchaseCancelled = searchParams.get("purchase") === "cancelled";

  // Fetch user's current plan
  useEffect(() => {
    if (status === "loading") return; // Wait for session to load

    if (session) {
      fetch("/api/billing/status")
        .then((res) => res.json())
        .then((data) => {
          if (data.plan) {
            setUserPlan(data.plan);
          }
        })
        .catch(() => {
          // Ignore errors, default to FREE
        })
        .finally(() => {
          setPlanLoading(false);
        });
    } else {
      setPlanLoading(false);
    }
  }, [session, status]);

  const isUpgrade = (planId: string) => {
    const currentIndex = PLAN_HIERARCHY.indexOf(userPlan);
    const targetIndex = PLAN_HIERARCHY.indexOf(planId);
    return targetIndex > currentIndex;
  };

  const isCurrentPlan = (planId: string) => {
    return userPlan === planId;
  };

  async function handleSubscribe(planId: string) {
    if (!session) {
      router.push(`/login?callbackUrl=/pricing`);
      return;
    }

    // If user has an active subscription, redirect to billing portal
    if (userPlan !== "FREE") {
      setLoadingBilling(true);
      try {
        const res = await fetch("/api/billing/portal", { method: "POST" });
        const data = await res.json();
        if (res.ok && data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error || "Failed to open billing portal");
          setLoadingBilling(false);
        }
      } catch {
        setError("Something went wrong. Please try again.");
        setLoadingBilling(false);
      }
      return;
    }

    setLoading(planId);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to start checkout");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleSingleUsePurchase() {
    if (!session) {
      router.push(`/login?callbackUrl=/pricing`);
      return;
    }

    setLoading("SINGLE_USE");
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "single_use" }),
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to start checkout");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const getButtonText = (planId: string) => {
    if (isCurrentPlan(planId)) return "Current Plan";
    if (userPlan !== "FREE" && isUpgrade(planId)) return "Upgrade";
    if (userPlan === "FREE") return "Get Started";
    return null; // Don't show button for downgrades
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-extrabold text-xl text-slate-800 tracking-tight">
              RFP Matrix
            </Link>
            <div className="flex items-center gap-3">
              {status === "authenticated" ? (
                <Link href="/dashboard">
                  <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" className="text-slate-600 hover:text-slate-900">Sign In</Button>
                  </Link>
                  <Link href="/signup">
                    <Button className="bg-[#14b8a6] hover:bg-[#0d9488] text-white">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium mb-4">
            Pricing
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            No hidden fees. Cancel anytime. Choose the plan that fits your RFP response needs.
          </p>
        </div>

        {/* Cancelled notice */}
        {(cancelled || purchaseCancelled) && (
          <div className="mb-8 p-4 bg-[#fef9c3] border border-[#fde047] rounded-xl text-center">
            <p className="text-[#a16207]">
              Checkout was cancelled. Feel free to try again when you&apos;re ready.
            </p>
          </div>
        )}

        {/* Error notice */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Subscription plans header */}
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-slate-900">Monthly Subscriptions</h2>
          <p className="mt-2 text-slate-600">For regular RFP responders - cancel anytime</p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const buttonText = getButtonText(plan.id);
            const isCurrent = isCurrentPlan(plan.id);
            const showButton = buttonText !== null;
            const isPopular = plan.popular && (!isCurrent || planLoading);

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 transition-shadow hover:shadow-lg flex flex-col ${
                  isPopular
                    ? "bg-slate-900 text-white lg:-mt-4 lg:mb-[-16px] shadow-2xl"
                    : plan.isEnterprise
                    ? "bg-gradient-to-br from-slate-800 to-slate-900 text-white"
                    : isCurrent && !planLoading
                    ? "bg-white border-2 border-[#16a34a]"
                    : "bg-white border border-slate-200"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-[#ffbe0b] text-black text-sm font-bold rounded-full">
                      Most popular
                    </span>
                  </div>
                )}
                {isCurrent && !planLoading && !isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-[#16a34a] text-white text-sm font-bold rounded-full">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-xl font-bold ${isPopular || plan.isEnterprise ? "text-white" : "text-slate-900"}`}>{plan.name}</h3>
                  <p className={`text-sm mt-1 ${isPopular ? "text-slate-400" : plan.isEnterprise ? "text-slate-400" : "text-slate-500"}`}>{plan.description}</p>
                </div>
                <div className="mb-6">
                  {plan.isEnterprise ? (
                    <span className={`text-2xl font-bold ${isPopular || plan.isEnterprise ? "text-white" : "text-slate-900"}`}>Contact Sales</span>
                  ) : (
                    <>
                      <span className={`text-5xl font-bold ${isPopular ? "text-white" : "text-slate-900"}`}>
                        ${plan.price}
                      </span>
                      <span className={isPopular ? "text-slate-400" : "text-slate-500"}>{plan.period}</span>
                    </>
                  )}
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <svg
                        className={`w-5 h-5 flex-shrink-0 ${isPopular ? "text-[#ffbe0b]" : "text-emerald-500"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className={`text-sm ${isPopular || plan.isEnterprise ? "text-white" : "text-slate-700"}`}>{feature}</span>
                    </li>
                  ))}
                  {plan.limitations.map((limitation, i) => (
                    <li key={`lim-${i}`} className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-slate-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      <span className={`text-sm ${isPopular ? "text-slate-400" : "text-slate-400"}`}>{limitation}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  {(status === "loading" || (planLoading && status === "authenticated")) ? (
                    <div className="w-full h-12 bg-slate-200 rounded-xl animate-pulse" />
                  ) : plan.isEnterprise ? (
                    <a href="mailto:sales@rfpmatrix.com?subject=Enterprise%20Plan%20Inquiry">
                      <Button variant="outline" className="w-full h-12 border-white/30 text-white hover:bg-white/10">
                        Contact Sales
                      </Button>
                    </a>
                  ) : showButton && (
                    <Button
                      className={`w-full h-12 ${
                        isCurrent
                          ? "bg-[#16a34a] hover:bg-[#16a34a] cursor-default text-white"
                          : isPopular
                          ? "bg-[#ffbe0b] hover:bg-[#ffd60a] text-black font-semibold"
                          : "border-slate-300 hover:bg-slate-50"
                      }`}
                      variant={!isCurrent && !isPopular ? "outline" : "default"}
                      onClick={() => !isCurrent && handleSubscribe(plan.id)}
                      disabled={isCurrent || loading === plan.id || loadingBilling}
                    >
                      {loading === plan.id || (loadingBilling && !isCurrent && isUpgrade(plan.id)) ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        buttonText
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="relative my-16">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-[#f8f7f4] px-4 text-slate-500">
              Or pay once for a single project
            </span>
          </div>
        </div>

        {/* Single-use option */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Just need one RFP?</h2>
            <p className="mt-2 text-slate-600">Pay once, no subscription required</p>
          </div>
          <div className="max-w-md mx-auto">
            <div className="relative rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-8 border border-amber-200 hover:shadow-lg transition-shadow">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 bg-amber-500 text-white text-sm font-bold rounded-full">
                  One-Time Purchase
                </span>
              </div>

              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{singleUsePlan.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{singleUsePlan.description}</p>
                </div>
                <span className="text-2xl font-bold text-slate-900">${singleUsePlan.price}</span>
              </div>

              <ul className="space-y-2 mb-6 text-sm text-slate-700">
                {singleUsePlan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-amber-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
                {singleUsePlan.limitations.map((limitation, i) => (
                  <li key={`lim-${i}`} className="flex items-center gap-2 text-slate-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    {limitation}
                  </li>
                ))}
              </ul>

              <Button
                className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                onClick={handleSingleUsePurchase}
                disabled={loading === "SINGLE_USE"}
              >
                {loading === "SINGLE_USE" ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  `${singleUsePlan.cta} - $${singleUsePlan.price}`
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* FAQ or trust indicators */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 max-w-3xl mx-auto grid gap-6 text-left">
            <div className="p-6 bg-white rounded-2xl border border-slate-200">
              <h3 className="font-semibold text-slate-900">Can I change plans later?</h3>
              <p className="mt-2 text-slate-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.
              </p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200">
              <h3 className="font-semibold text-slate-900">What happens if I exceed my limits?</h3>
              <p className="mt-2 text-slate-600">
                You&apos;ll be prompted to upgrade or wait until your limits reset at the start of your next billing period.
              </p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200">
              <h3 className="font-semibold text-slate-900">Can I cancel anytime?</h3>
              <p className="mt-2 text-slate-600">
                Absolutely. Cancel anytime from your account settings. You&apos;ll retain access until the end of your current billing period.
              </p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200">
              <h3 className="font-semibold text-slate-900">Is my data secure?</h3>
              <p className="mt-2 text-slate-600">
                Yes. All data is encrypted at rest and in transit. We&apos;re GDPR and CCPA compliant. Your RFP documents are never shared or used for training.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center p-12 bg-gradient-to-br from-[#0d9488] to-[#0f766e] rounded-3xl text-white shadow-lg">
          <h2 className="text-2xl font-bold">
            Ready to respond to RFPs faster?
          </h2>
          <p className="mt-4 text-white/80 max-w-xl mx-auto">
            Join businesses saving hours on every RFP response with AI-powered extraction and drafting.
          </p>
          <div className="mt-8">
            <Link href={status === "authenticated" ? "/dashboard" : "/signup"}>
              <Button size="lg" className="px-8 bg-white text-[#0d9488] hover:bg-slate-50 font-semibold">
                {status === "authenticated" ? "Go to Dashboard" : "Get Started"}
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} RFP Matrix. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-slate-500">
              <Link href="/privacy" className="hover:text-[#0d9488] transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-[#0d9488] transition-colors">Terms of Service</Link>
              <Link href="/cookies" className="hover:text-[#0d9488] transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4]">
        <svg className="animate-spin h-8 w-8 text-[#14b8a6]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}
