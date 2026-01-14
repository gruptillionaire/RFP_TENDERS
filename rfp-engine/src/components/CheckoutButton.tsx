"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CheckoutButtonProps {
  plan: string; // 'STARTER' | 'PRO' | 'TEAM' | 'BUSINESS' | 'SINGLE_USE'
  isSignedIn: boolean;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export function CheckoutButton({
  plan,
  isSignedIn,
  children,
  variant = "default",
  className = "",
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);

    if (!isSignedIn) {
      // Redirect to checkout page (will handle login redirect)
      window.location.href = `/checkout/${plan}`;
      return;
    }

    setLoading(true);

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
        setLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <Button
        variant={variant}
        className={`${className} w-full`}
        onClick={handleClick}
        disabled={loading}
        type="button"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          children
        )}
      </Button>
      {error && (
        <p className="text-xs text-red-600 mt-1 text-center">{error}</p>
      )}
    </div>
  );
}
