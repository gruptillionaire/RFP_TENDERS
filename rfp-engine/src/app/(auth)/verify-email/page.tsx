"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const token = searchParams.get("token");
  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Verify token on mount (only once per token)
  useEffect(() => {
    if (!token) return;

    // Check if we've already attempted this specific token (survives re-renders)
    const storageKey = `verify-attempted-${token}`;
    if (sessionStorage.getItem(storageKey)) {
      if (sessionStorage.getItem(`verify-success-${token}`)) {
        setStatus("success");
        setMessage("Your email has been verified successfully!");
        setTimeout(() => { window.location.href = redirectUrl; }, 500);
      }
      return;
    }

    // Mark as attempted before making the request
    sessionStorage.setItem(storageKey, "true");
    setStatus("verifying");

    const verifyToken = async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (data.success) {
          sessionStorage.setItem(`verify-success-${token}`, "true");
          setStatus("success");
          setMessage(data.alreadyVerified
            ? "Your email was already verified."
            : "Your email has been verified successfully!");

          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1500);
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed. Please try again.");
        }
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    };

    verifyToken();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResend = async () => {
    setResending(true);
    setResendMessage(null);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setResendMessage(data.alreadyVerified
          ? "Your email is already verified!"
          : "Verification email sent! Check your inbox.");
      } else {
        setResendMessage(data.error || "Failed to send verification email");
      }
    } catch {
      setResendMessage("Failed to send verification email");
    } finally {
      setResending(false);
    }
  };

  // If token is being verified, show loading state
  if (token && status === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
        <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-[#14b8a6] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-600">Verifying your email...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If verification was attempted, show result
  if (token && (status === "success" || status === "error")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
        <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="pt-8 pb-8 text-center">
            <Link href="/" className="font-extrabold text-2xl text-slate-800 tracking-tight mb-6 block">
              RFP Matrix
            </Link>
            {status === "success" ? (
              <>
                <div className="w-16 h-16 bg-[#dcfce7] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[#16a34a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Email Verified!</h2>
                <p className="text-slate-600 mb-4">{message}</p>
                <p className="text-sm text-slate-400">Redirecting to dashboard...</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Verification Failed</h2>
                <p className="text-slate-600 mb-4">{message}</p>
                <div className="space-y-2">
                  <Button onClick={handleResend} disabled={resending} className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white">
                    {resending ? "Sending..." : "Resend Verification Email"}
                  </Button>
                  <Link href="/dashboard">
                    <Button variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50">
                      Go to Dashboard
                    </Button>
                  </Link>
                </div>
                {resendMessage && (
                  <p className="mt-3 text-sm text-slate-600">{resendMessage}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default state: no token, show instructions
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
      <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="text-center pb-2">
          <Link href="/" className="font-extrabold text-2xl text-slate-800 tracking-tight mb-4 block">
            RFP Matrix
          </Link>
          <div className="w-16 h-16 bg-[#ccfbf1] rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">Verify Your Email</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {session?.user ? (
            <>
              <p className="text-slate-600 mb-6">
                We sent a verification email to <strong className="text-slate-700">{session.user.email}</strong>.
                Please check your inbox and click the verification link.
              </p>

              <div className="bg-[#fef9c3] border border-[#fde047] rounded-xl p-4 mb-6">
                <p className="text-sm text-[#a16207]">
                  <strong>Note:</strong> Some features are restricted until you verify your email.
                  Once verified, you&apos;ll have full access to all RFP Matrix features.
                </p>
              </div>

              <div className="space-y-3">
                <Button onClick={handleResend} disabled={resending} className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white">
                  {resending ? "Sending..." : "Resend Verification Email"}
                </Button>
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>

              {resendMessage && (
                <p className="mt-4 text-sm text-slate-600">{resendMessage}</p>
              )}

              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Didn&apos;t receive the email? Check your spam folder, or make sure you entered the correct email address.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-600 mb-6">
                Please log in to view your email verification status.
              </p>
              <Link href="/login">
                <Button className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white">Log In</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
        <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-[#14b8a6] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
