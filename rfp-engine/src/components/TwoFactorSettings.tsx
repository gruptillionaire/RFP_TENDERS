"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
}

export function TwoFactorSettings() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Setup state
  const [setupMode, setSetupMode] = useState(false);
  const [setupData, setSetupData] = useState<{
    qrCode: string;
    secret: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Disable state
  const [disableMode, setDisableMode] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/2fa/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setError("Failed to load 2FA status");
      }
    } catch {
      setError("Failed to load 2FA status");
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    try {
      setError(null);
      setSetupMode(true);

      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setSetupData({
          qrCode: data.qrCode,
          secret: data.secret,
        });
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to start 2FA setup");
        setSetupMode(false);
      }
    } catch {
      setError("Failed to start 2FA setup");
      setSetupMode(false);
    }
  };

  const verifySetup = async () => {
    if (!verifyCode.trim()) {
      setError("Please enter the verification code");
      return;
    }

    try {
      setVerifying(true);
      setError(null);

      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });

      if (res.ok) {
        const data = await res.json();
        setBackupCodes(data.backupCodes);
        setSetupData(null);
        setVerifyCode("");
        await fetchStatus();
      } else {
        const errData = await res.json();
        setError(errData.error || "Verification failed");
      }
    } catch {
      setError("Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const disable2FA = async () => {
    if (!disableCode.trim()) {
      setError("Please enter your code or password");
      return;
    }

    try {
      setDisabling(true);
      setError(null);

      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });

      if (res.ok) {
        setDisableMode(false);
        setDisableCode("");
        await fetchStatus();
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to disable 2FA");
      }
    } catch {
      setError("Failed to disable 2FA");
    } finally {
      setDisabling(false);
    }
  };

  const closeBackupCodes = () => {
    setBackupCodes(null);
    setSetupMode(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Show backup codes after successful setup
  if (backupCodes) {
    return (
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="text-green-700">2FA Enabled Successfully!</CardTitle>
          <CardDescription>
            Save these backup codes in a secure location. Each code can only be used once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-100 rounded-lg p-4 font-mono text-sm grid grid-cols-2 gap-2">
            {backupCodes.map((code, i) => (
              <div key={i} className="bg-white px-3 py-2 rounded border text-center">
                {code}
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> Store these codes securely. If you lose access to your authenticator app,
              you&apos;ll need these codes to log in.
            </p>
          </div>
          <Button onClick={closeBackupCodes} className="w-full">
            I&apos;ve Saved My Backup Codes
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Add an extra layer of security to your account using an authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {status?.enabled ? (
          // 2FA is enabled
          <>
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="font-medium text-green-800">2FA is enabled</p>
                <p className="text-sm text-green-600">
                  {status.backupCodesRemaining} backup codes remaining
                </p>
              </div>
            </div>

            {!disableMode ? (
              <Button
                variant="outline"
                onClick={() => setDisableMode(true)}
                className="text-red-600 hover:text-red-700 hover:border-red-300"
              >
                Disable 2FA
              </Button>
            ) : (
              <div className="space-y-3 p-4 border rounded-lg">
                <p className="text-sm text-gray-600">
                  Enter your authenticator code or a backup code to disable 2FA:
                </p>
                <Input
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="Enter code"
                  className="font-mono"
                />
                <div className="flex gap-2">
                  <Button onClick={disable2FA} disabled={disabling} variant="destructive">
                    {disabling ? "Disabling..." : "Disable 2FA"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDisableMode(false);
                      setDisableCode("");
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          // 2FA is not enabled
          <>
            {!setupMode ? (
              <Button onClick={startSetup}>Enable 2FA</Button>
            ) : setupData ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                  <div className="inline-block p-4 bg-white border rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={setupData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Or enter this code manually:</p>
                  <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono">
                    {setupData.secret}
                  </code>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Enter the 6-digit code from your app:
                  </label>
                  <Input
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="text-center font-mono text-lg tracking-widest"
                    maxLength={6}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={verifySetup}
                    disabled={verifying || verifyCode.length !== 6}
                    className="flex-1"
                  >
                    {verifying ? "Verifying..." : "Verify & Enable"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSetupMode(false);
                      setSetupData(null);
                      setVerifyCode("");
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="ml-2 text-gray-600">Setting up...</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
