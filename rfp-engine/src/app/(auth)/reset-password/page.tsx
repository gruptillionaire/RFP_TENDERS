"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setTokenError("No reset token provided.");
      return;
    }

    async function validateToken() {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${token}`);
        const data = await res.json();

        if (data.valid) {
          setTokenValid(true);
          setMaskedEmail(data.email);
        } else {
          setTokenValid(false);
          setTokenError(data.error || "Invalid reset link.");
        }
      } catch {
        setTokenValid(false);
        setTokenError("Failed to validate reset link.");
      }
    }

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Basic password validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError("Password must contain uppercase, lowercase, and a number.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Loading state while validating token
  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
        <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#14b8a6] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-600">Validating reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
        <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="space-y-1 text-center pb-2">
            <Link href="/" className="font-extrabold text-2xl text-slate-800 tracking-tight mb-4 block">
              RFP Matrix
            </Link>
            <div className="mx-auto w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-red-600"
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
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Invalid Reset Link</CardTitle>
            <CardDescription className="text-base text-slate-500">
              {tokenError}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Link href="/forgot-password" className="w-full">
              <Button className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white">Request a new link</Button>
            </Link>
            <Link href="/login" className="text-sm text-[#0d9488] hover:text-[#0f766e] font-medium">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
        <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="space-y-1 text-center pb-2">
            <Link href="/" className="font-extrabold text-2xl text-slate-800 tracking-tight mb-4 block">
              RFP Matrix
            </Link>
            <div className="mx-auto w-14 h-14 bg-[#dcfce7] rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-[#16a34a]"
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
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Password Reset!</CardTitle>
            <CardDescription className="text-base text-slate-500">
              Your password has been successfully reset. You can now sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-6">
            <Button
              className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white"
              onClick={() => router.push("/login")}
            >
              Sign in
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
      <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="space-y-1 text-center pb-2">
          <Link href="/" className="font-extrabold text-2xl text-slate-800 tracking-tight mb-4 block">
            RFP Matrix
          </Link>
          <CardTitle className="text-2xl font-bold text-slate-800">Reset your password</CardTitle>
          <CardDescription className="text-slate-500">
            Enter a new password for {maskedEmail}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-200">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
                required
                autoComplete="new-password"
                autoFocus
              />
              <p className="text-xs text-slate-400">
                At least 8 characters with uppercase, lowercase, and a number.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
                required
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Button type="submit" className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white" disabled={loading}>
              {loading ? "Resetting..." : "Reset password"}
            </Button>
            <Link href="/login" className="text-sm text-[#0d9488] hover:text-[#0f766e] font-medium">
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
          <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="py-12 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-[#14b8a6] border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-600">Loading...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
