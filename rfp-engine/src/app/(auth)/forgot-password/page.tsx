"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
            <CardTitle className="text-2xl font-bold text-slate-800">Check your email</CardTitle>
            <CardDescription className="text-base text-slate-500">
              If an account exists with <span className="font-medium text-slate-700">{email}</span>,
              you&apos;ll receive a password reset link shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-[#ccfbf1] text-[#0f766e] p-4 rounded-xl text-sm border border-[#99f6e4]">
              <p className="font-medium mb-1">Didn&apos;t receive the email?</p>
              <ul className="list-disc list-inside space-y-1 text-[#0d9488]">
                <li>Check your spam or junk folder</li>
                <li>Make sure you entered the correct email</li>
                <li>Wait a few minutes and try again</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Button
              variant="outline"
              className="w-full border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setSuccess(false);
                setEmail("");
              }}
            >
              Try a different email
            </Button>
            <Link href="/login" className="text-sm text-[#0d9488] hover:text-[#0f766e] font-medium">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
      <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="space-y-1 text-center pb-2">
          <Link href="/" className="font-extrabold text-2xl text-slate-800 tracking-tight mb-4 block">
            RFP Matrix
          </Link>
          <CardTitle className="text-2xl font-bold text-slate-800">Forgot password?</CardTitle>
          <CardDescription className="text-slate-500">
            Enter your email address and we&apos;ll send you a link to reset your password.
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
              <Label htmlFor="email" className="text-slate-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Button type="submit" className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </Button>
            <p className="text-sm text-slate-500 text-center">
              Remember your password?{" "}
              <Link href="/login" className="text-[#0d9488] hover:text-[#0f766e] font-medium">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
