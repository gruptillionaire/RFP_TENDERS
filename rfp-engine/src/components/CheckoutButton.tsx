"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!isSignedIn) {
      // Redirect to checkout page (will handle login redirect)
      router.push(`/checkout/${plan}`);
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
        // Fallback to pricing page on error
        router.push("/pricing");
      }
    } catch {
      router.push("/pricing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      className={className}
      onClick={handleClick}
      disabled={loading}
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
  );
}
