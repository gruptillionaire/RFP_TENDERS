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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [verifying2FA, setVerifying2FA] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Step 1: Pre-login check
      const preLoginRes = await fetch("/api/auth/pre-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const preLoginData = await preLoginRes.json();

      if (!preLoginRes.ok) {
        setError(preLoginData.error || "Invalid email or password");
        setLoading(false);
        return;
      }

      // Step 2: Check if 2FA is required
      if (preLoginData.requires2FA) {
        setRequires2FA(true);
        setPendingToken(preLoginData.pendingToken);
        setLoading(false);
        return;
      }

      // Step 3: No 2FA, proceed with normal login
      await completeLogin();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVerifying2FA(true);

    try {
      // Verify 2FA code
      const challengeRes = await fetch("/api/auth/2fa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingToken,
          code: twoFactorCode,
        }),
      });

      const challengeData = await challengeRes.json();

      if (!challengeRes.ok) {
        setError(challengeData.error || "Invalid verification code");
        setVerifying2FA(false);
        return;
      }

      // Show warning if backup code was used
      if (challengeData.usedBackupCode) {
        const remaining = challengeData.remainingBackupCodes;
        if (remaining <= 3) {
          alert(`Warning: You have only ${remaining} backup codes remaining. Consider generating new ones in Settings.`);
        }
      }

      // 2FA verified, complete login
      await completeLogin();
    } catch {
      setError("Verification failed");
      setVerifying2FA(false);
    }
  };

  const completeLogin = async () => {
    const result = await signIn("credentials", {
      email,
      password,
      rememberMe: rememberMe.toString(),
      redirect: false,
    });

    if (result?.error) {
      setError("Login failed. Please try again.");
      setLoading(false);
      setVerifying2FA(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  const cancelTwoFactor = () => {
    setRequires2FA(false);
    setPendingToken("");
    setTwoFactorCode("");
    setError("");
  };

  // 2FA verification screen
  if (requires2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero-subtle px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app
            </CardDescription>
          </CardHeader>
          <form onSubmit={handle2FASubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">Verification Code</Label>
                <Input
                  id="twoFactorCode"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="text-center font-mono text-lg tracking-widest"
                  autoFocus
                  required
                />
                <p className="text-xs text-muted-foreground">
                  You can also use a backup code if you don&apos;t have access to your authenticator
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-6">
              <Button type="submit" className="w-full" disabled={verifying2FA}>
                {verifying2FA ? "Verifying..." : "Verify"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={cancelTwoFactor}
              >
                Back to login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // Normal login screen
  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero-subtle px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Link href="/" className="font-bold text-xl gradient-text mb-4 inline-block">RFP Matrix</Link>
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <Label htmlFor="rememberMe" className="text-sm font-normal text-muted-foreground cursor-pointer">
                Remember me for 30 days
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
