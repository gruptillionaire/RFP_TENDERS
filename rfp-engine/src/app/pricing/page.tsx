"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

const plans = [
  {
    id: "SOLO",
    name: "Solo",
    price: 39,
    period: "/month",
    description: "For freelancers and individual consultants",
    features: [
      "5 RFP extractions per month",
      "100 AI draft responses per month",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word",
    ],
    limitations: [],
    cta: "Get Started",
    popular: false,
  },
  {
    id: "PRO",
    name: "Pro",
    price: 99,
    period: "/month",
    description: "For SMEs and growing businesses",
    features: [
      "15 RFP extractions per month",
      "500 AI draft responses per month",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word",
      "Priority support",
    ],
    limitations: [],
    cta: "Get Started",
    popular: true,
  },
  {
    id: "TEAM",
    name: "Team",
    price: 249,
    period: "/month",
    description: "For agencies and high-volume users",
    features: [
      "Unlimited RFP extractions",
      "Unlimited AI draft responses",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word",
      "Priority support",
    ],
    limitations: [],
    cta: "Get Started",
    popular: false,
  },
];

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelled = searchParams.get("subscription") === "cancelled";

  async function handleSubscribe(planId: string) {
    if (!session) {
      // Redirect to login with return URL
      router.push(`/login?callbackUrl=/pricing`);
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
        // Redirect to Stripe Checkout
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-gray-900">
              RFP Engine
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
        {cancelled && (
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

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl bg-white p-8 shadow-sm border-2 transition-shadow hover:shadow-lg ${
                plan.popular ? "border-blue-500" : "border-gray-200"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-medium bg-blue-500 text-white">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price === 0 ? "Free" : `£${plan.price}`}
                  </span>
                  {plan.period && (
                    <span className="text-gray-500">{plan.period}</span>
                  )}
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

              <div className="mt-8">
                <Button
                  className={`w-full ${plan.popular ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id}
                >
                  {loading === plan.id ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    plan.cta
                  )}
                </Button>
              </div>
            </div>
          ))}
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
              &copy; {new Date().getFullYear()} RFP Engine. All rights reserved.
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
