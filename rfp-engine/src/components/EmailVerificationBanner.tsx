"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmailVerificationBannerProps {
  emailVerified: boolean | Date | null | undefined;
}

export function EmailVerificationBanner({ emailVerified }: EmailVerificationBannerProps) {
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Don't show banner if email is verified
  if (emailVerified) {
    return null;
  }

  const handleResend = async () => {
    setResending(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setMessage(data.alreadyVerified
          ? "Your email is already verified!"
          : "Verification email sent! Check your inbox.");
      } else {
        setMessage(data.error || "Failed to send verification email");
      }
    } catch {
      setMessage("Failed to send verification email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-b border-yellow-200">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Please verify your email address
              </p>
              <p className="text-xs text-yellow-700">
                Some features are restricted until your email is verified.{" "}
                <Link href="/verify-email" className="underline hover:text-yellow-900">
                  Learn more
                </Link>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {message && (
              <span className="text-xs text-yellow-700">{message}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={resending}
              className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            >
              {resending ? "Sending..." : "Resend Email"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
