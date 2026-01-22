"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Note: Middleware handles redirecting logged-in users to /dashboard
// No client-side session check needed here

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTermsAndPrivacy, setAcceptTermsAndPrivacy] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate consent checkbox
    if (!acceptTermsAndPrivacy) {
      setError("You must accept the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    setLoading(true);

    try {
      // Create user with consent data
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          acceptTerms: acceptTermsAndPrivacy,
          acceptPrivacy: acceptTermsAndPrivacy,
          acceptMarketing,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        return;
      }

      // Sign in after signup
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but failed to sign in. Please try logging in.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      // Network or unexpected errors
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("Unable to connect. Please check your internet connection.");
      } else {
        setError("Unable to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4 py-8">
      <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="space-y-1 text-center pb-2">
          <Link href="/" className="font-extrabold text-2xl text-slate-800 tracking-tight mb-4 block">
            RFP Matrix
          </Link>
          <CardTitle className="text-2xl font-bold text-slate-800">Create an account</CardTitle>
          <CardDescription className="text-slate-500">
            Enter your details to get started with RFP Matrix
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
              <Label htmlFor="name" className="text-slate-700">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
              />
            </div>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
                required
                minLength={8}
              />
              <p className="text-xs text-slate-400">
                Must include uppercase, lowercase, number, and special character
              </p>
            </div>

            {/* Consent Checkboxes */}
            <div className="space-y-3 pt-4 mt-2 border-t border-slate-100">
              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="acceptTermsAndPrivacy"
                  checked={acceptTermsAndPrivacy}
                  onChange={(e) => setAcceptTermsAndPrivacy(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#14b8a6] focus:ring-[#14b8a6]"
                  required
                />
                <label htmlFor="acceptTermsAndPrivacy" className="text-sm text-slate-600">
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="text-[#0d9488] hover:text-[#0f766e]">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" className="text-[#0d9488] hover:text-[#0f766e]">
                    Privacy Policy
                  </Link>{" "}
                  <span className="text-red-500">*</span>
                </label>
              </div>

              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="acceptMarketing"
                  checked={acceptMarketing}
                  onChange={(e) => setAcceptMarketing(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#14b8a6] focus:ring-[#14b8a6]"
                />
                <label htmlFor="acceptMarketing" className="text-sm text-slate-600">
                  I would like to receive product updates and marketing emails
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Button type="submit" className="w-full bg-[#14b8a6] hover:bg-[#0d9488] text-white" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-sm text-slate-500 text-center">
              Already have an account?{" "}
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
