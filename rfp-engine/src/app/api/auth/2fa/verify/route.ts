/**
 * /api/auth/2fa/verify
 *
 * POST - Verify TOTP code and enable 2FA
 *
 * Body: { code: string }
 *
 * Returns:
 * - success: boolean
 * - backupCodes: string[] (only on first enable)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptTOTPSecret, generateBackupCodes } from "@/lib/crypto";
import { rateLimiters, rateLimitHeaders } from "@/lib/rate-limit";
import * as OTPAuth from "otpauth";
import bcrypt from "bcryptjs";
import { sendTwoFactorEnabledEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting - prevent brute force attacks on TOTP codes
    const rateLimit = await rateLimiters.twoFactorVerify(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      );
    }

    // Get user with 2FA secret
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: "2FA setup not started. Please start setup first." },
        { status: 400 }
      );
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is already enabled" },
        { status: 400 }
      );
    }

    // Decrypt and verify the code
    const secret = decryptTOTPSecret(user.twoFactorSecret);

    const totp = new OTPAuth.TOTP({
      issuer: "RFP Matrix",
      label: session.user.email || "",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // Validate with a window of 1 (allows for slight time drift)
    const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });

    if (delta === null) {
      return NextResponse.json(
        { error: "Invalid verification code. Please try again." },
        { status: 400 }
      );
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);

    // Hash backup codes for storage
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c, 10))
    );

    // Enable 2FA
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorVerifiedAt: new Date(),
        twoFactorBackupCodes: hashedBackupCodes,
      },
    });

    // Send notification email (don't await - fire and forget)
    if (session.user.email) {
      sendTwoFactorEnabledEmail(session.user.email).catch((err) =>
        console.error("Failed to send 2FA enabled email:", err)
      );
    }

    return NextResponse.json({
      success: true,
      backupCodes, // Return plaintext codes once - user must save them
      message: "2FA has been enabled. Please save your backup codes securely.",
    });
  } catch (error) {
    console.error("2FA verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify 2FA" },
      { status: 500 }
    );
  }
}
