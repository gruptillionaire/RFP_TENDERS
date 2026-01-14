"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

// Plan hierarchy for determining upgrades
const PLAN_HIERARCHY = ["FREE", "STARTER", "PRO", "TEAM", "BUSINESS"];

// Single-use one-time purchase
const singleUsePlan = {
  id: "SINGLE_USE",
  name: "Single RFP",
  price: 40,
  period: "one-time",
  description: "Perfect for a single RFP project",
  features: [
    "1 RFP extraction",
    "60 AI draft responses",
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
    price: 49,
    period: "/month",
    description: "For freelancers and individual consultants",
    features: [
      "5 RFP extractions per month",
      "250 AI draft responses per month",
      "AI-powered requirement detection",
      "Export to PDF",
    ],
    limitations: [
      "No Word export (PDF only)",
      "No response library",
    ],
    popular: false,
  },
  {
    id: "PRO",
    name: "Pro",
    price: 99,
    period: "/month",
    description: "For SMEs and growing businesses",
    features: [
      "10 RFP extractions per month",
      "500 AI draft responses per month",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word & PDF",
    ],
    limitations: [],
    popular: true,
  },
  {
    id: "TEAM",
    name: "Team",
    price: 179,
    period: "/month",
    description: "For growing teams",
    features: [
      "25 RFP extractions per month",
      "1,000 AI draft responses per month",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word & PDF",
      "Priority support",
    ],
    limitations: [],
    popular: false,
  },
  {
    id: "BUSINESS",
    name: "Business",
    price: 249,
    period: "/month",
    description: "For agencies and high-volume users",
    features: [
      "Unlimited RFP extractions",
      "Unlimited AI draft responses",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word & PDF",
      "Priority support",
    ],
    limitations: [],
    popular: false,
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-gray-900">
              RFP Matrix
            </Link>
            <div className="flex items-center gap-4">
              {status === "authenticated" ? (
                <Link href="/dashboard">
                  <Button variant="outline">Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost">Sign In</Button>
                  </Link>
                  <Link href="/signup">
                    <Button>Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your RFP response needs. All plans include our AI-powered extraction and drafting.
          </p>
        </div>

        {/* Cancelled notice */}
        {(cancelled || purchaseCancelled) && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
            <p className="text-yellow-800">
              Checkout was cancelled. Feel free to try again when you're ready.
            </p>
          </div>
        )}

        {/* Error notice */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Subscription plans header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Monthly Subscriptions</h2>
          <p className="mt-2 text-gray-600">For regular RFP responders - cancel anytime</p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const buttonText = getButtonText(plan.id);
            const isCurrent = isCurrentPlan(plan.id);
            const showButton = buttonText !== null;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl bg-white p-8 shadow-sm border-2 transition-shadow hover:shadow-lg flex flex-col ${
                  plan.popular ? "border-blue-500" : (isCurrent && !planLoading) ? "border-green-500" : "border-gray-200"
                }`}
              >
                {plan.popular && (!isCurrent || planLoading) && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-medium bg-blue-500 text-white">
                      Most Popular
                    </span>
                  </div>
                )}
                {isCurrent && !planLoading && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-medium bg-green-500 text-white">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-gray-900">
                      £{plan.price}
                    </span>
                    <span className="text-gray-500">{plan.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
                </div>

                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
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
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                  {plan.limitations.map((limitation, i) => (
                    <li key={`lim-${i}`} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5"
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
                      <span className="text-sm text-gray-400">{limitation}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  {(status === "loading" || (planLoading && status === "authenticated")) ? (
                    // Loading skeleton while determining session or fetching user's plan
                    <div className="w-full h-10 bg-gray-200 rounded-md animate-pulse" />
                  ) : showButton && (
                    <Button
                      className={`w-full ${
                        isCurrent
                          ? "bg-green-600 hover:bg-green-600 cursor-default"
                          : plan.popular
                          ? "bg-blue-600 hover:bg-blue-700"
                          : ""
                      }`}
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
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-gradient-to-b from-gray-50 to-white px-4 text-gray-500">
              Or pay once for a single project
            </span>
          </div>
        </div>

        {/* Single-use option */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Just need one RFP?</h2>
            <p className="mt-2 text-gray-600">Pay once, no subscription required</p>
          </div>
          <div className="max-w-md mx-auto">
            <div className="relative rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 p-8 shadow-sm border-2 border-orange-300 hover:shadow-lg transition-shadow">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-medium bg-orange-500 text-white">
                  One-Time Purchase
                </span>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">{singleUsePlan.name}</h3>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-gray-900">£{singleUsePlan.price}</span>
                  <span className="text-gray-500">{singleUsePlan.period}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{singleUsePlan.description}</p>
              </div>

              <ul className="mt-8 space-y-3">
                {singleUsePlan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
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
                    <span className="text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
                {singleUsePlan.limitations.map((limitation, i) => (
                  <li key={`lim-${i}`} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5"
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
                    <span className="text-sm text-gray-400">{limitation}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
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
                    `${singleUsePlan.cta} - £${singleUsePlan.price}`
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ or trust indicators */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 max-w-3xl mx-auto grid gap-6 text-left">
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">Can I change plans later?</h3>
              <p className="mt-2 text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">What happens if I exceed my limits?</h3>
              <p className="mt-2 text-gray-600">
                You'll be prompted to upgrade or wait until your limits reset at the start of your next billing period.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">Can I cancel anytime?</h3>
              <p className="mt-2 text-gray-600">
                Absolutely. Cancel anytime from your account settings. You'll retain access until the end of your current billing period.
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">Is my data secure?</h3>
              <p className="mt-2 text-gray-600">
                Yes. All data is encrypted at rest and in transit. We're GDPR and CCPA compliant. Your RFP documents are never shared or used for training.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center p-12 bg-blue-50 rounded-2xl">
          <h2 className="text-2xl font-bold text-gray-900">
            Ready to respond to RFPs faster?
          </h2>
          <p className="mt-4 text-gray-600 max-w-xl mx-auto">
            Join businesses saving hours on every RFP response with AI-powered extraction and drafting.
          </p>
          <div className="mt-8">
            <Link href="/signup">
              <Button size="lg" className="px-8">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} RFP Matrix. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link href="/privacy" className="hover:text-gray-900">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-gray-900">Terms of Service</Link>
              <Link href="/cookies" className="hover:text-gray-900">Cookie Policy</Link>
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
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}
