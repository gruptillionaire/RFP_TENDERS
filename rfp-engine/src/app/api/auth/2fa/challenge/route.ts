/**
 * /api/auth/2fa/challenge
 *
 * POST - Verify 2FA code during login
 *
 * Body: { pendingToken: string, code: string }
 *
 * This is called after initial password verification (via /api/auth/pre-login)
 * but before the session is fully created, for users with 2FA enabled.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptTOTPSecret } from "@/lib/crypto";
import * as OTPAuth from "otpauth";
import bcrypt from "bcryptjs";
import { verifyPendingSession, clearPendingSession } from "@/app/api/auth/pre-login/route";
import { check2FARateLimit, clear2FARateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pendingToken, code } = body;

    if (!pendingToken || !code) {
      return NextResponse.json(
        { error: "Pending token and code are required" },
        { status: 400 }
      );
    }

    // Verify the pending session from pre-login
    const pendingSession = await verifyPendingSession(pendingToken);
    if (!pendingSession.valid || !pendingSession.userId) {
      return NextResponse.json(
        { error: "Session expired. Please log in again." },
        { status: 401 }
      );
    }

    const pendingUserId = pendingSession.userId;

    // Rate limiting (Redis-based)
    const rateLimit = await check2FARateLimit(pendingUserId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: pendingUserId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const cleanCode = code.replace(/\s/g, "");
    let verified = false;
    let usedBackupCode = false;

    // Try TOTP verification first
    try {
      const secret = decryptTOTPSecret(user.twoFactorSecret);

      const totp = new OTPAuth.TOTP({
        issuer: "RFP Matrix",
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const delta = totp.validate({ token: cleanCode, window: 1 });
      if (delta !== null) {
        verified = true;
      }
    } catch {
      // Decryption failed, continue to backup codes
    }

    // Try backup codes if TOTP failed
    if (!verified && user.twoFactorBackupCodes.length > 0) {
      const upperCode = cleanCode.toUpperCase();
      for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
        if (await bcrypt.compare(upperCode, user.twoFactorBackupCodes[i])) {
          verified = true;
          usedBackupCode = true;

          // Remove used backup code
          const newCodes = [...user.twoFactorBackupCodes];
          newCodes.splice(i, 1);
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorBackupCodes: newCodes },
          });

          break;
        }
      }
    }

    if (!verified) {
      return NextResponse.json(
        {
          error: "Invalid verification code",
          remainingAttempts: rateLimit.remainingAttempts,
        },
        { status: 400 }
      );
    }

    // Clear rate limit and pending session on success
    await clear2FARateLimit(pendingUserId);
    await clearPendingSession(pendingToken);

    return NextResponse.json({
      success: true,
      userId: user.id, // Return user ID for login completion
      usedBackupCode,
      remainingBackupCodes: usedBackupCode
        ? user.twoFactorBackupCodes.length - 1
        : undefined,
    });
  } catch (error) {
    console.error("2FA challenge error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
