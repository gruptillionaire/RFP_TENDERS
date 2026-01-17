"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";

const VALID_PLANS = ["STARTER", "PRO", "BUSINESS", "SINGLE_USE"];

export default function CheckoutRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const { status } = useSession();
  const [error, setError] = useState<string | null>(null);

  const plan = params.plan as string;

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      // Redirect to login with callback back to this page
      router.push(`/login?callbackUrl=/checkout/${plan}`);
      return;
    }

    // Validate plan
    if (!VALID_PLANS.includes(plan)) {
      router.push("/pricing");
      return;
    }

    // Initiate checkout
    async function startCheckout() {
      try {
        const body =
          plan === "SINGLE_USE"
            ? { type: "single_use" }
            : { plan };

        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (res.ok && data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error || "Failed to start checkout");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    }

    startCheckout();
  }, [status, plan, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => router.push("/pricing")}
            className="text-blue-600 hover:underline"
          >
            Return to Pricing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <svg
          className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p className="text-gray-600">Redirecting to checkout...</p>
      </div>
    </div>
  );
}
