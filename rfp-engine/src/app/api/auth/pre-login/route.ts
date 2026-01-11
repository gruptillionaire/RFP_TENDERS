/**
 * /api/auth/pre-login
 *
 * POST - Check credentials and determine if 2FA is required
 *
 * This is called BEFORE NextAuth signIn to check if 2FA verification is needed.
 *
 * Body: { email: string, password: string }
 *
 * Returns:
 * - success: true, requires2FA: false -> proceed with normal login
 * - success: true, requires2FA: true, pendingUserId -> show 2FA challenge
 * - success: false, error -> show error message
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Rate limiting (mirrors auth.ts)
const loginAttempts = new Map<string, { count: number; resetAt: number; lockedUntil?: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function checkLoginRateLimit(email: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const key = email.toLowerCase().trim();
  const record = loginAttempts.get(key);

  if (record?.lockedUntil && record.lockedUntil > now) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return {
      allowed: false,
      message: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
    };
  }

  if (!record || record.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return {
      allowed: false,
      message: "Too many failed attempts. Account temporarily locked for 15 minutes.",
    };
  }

  record.count++;
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limit
    const rateLimit = checkLoginRateLimit(normalizedEmail);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: rateLimit.message },
        { status: 429 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        twoFactorEnabled: true,
      },
    });

    if (!user || !user.passwordHash) {
      // Constant-time behavior to prevent timing attacks
      await bcrypt.compare(password, "$2a$12$invalid.hash.to.prevent.timing.attacks");
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate a pending token for this 2FA session
      const pendingToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Store the pending session in database
      await prisma.pending2FASession.create({
        data: {
          token: pendingToken,
          userId: user.id,
          expiresAt,
        },
      });

      // Clean up expired sessions (run in background, don't await)
      prisma.pending2FASession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      }).catch(() => {
        // Ignore cleanup errors
      });

      return NextResponse.json({
        success: true,
        requires2FA: true,
        pendingToken, // Frontend needs this to complete 2FA
        pendingUserId: user.id,
      });
    }

    // No 2FA - can proceed with normal login
    return NextResponse.json({
      success: true,
      requires2FA: false,
    });
  } catch (error) {
    console.error("Pre-login error:", error);
    return NextResponse.json(
      { success: false, error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}

// Export for use by 2FA challenge endpoint
export async function verifyPendingSession(pendingToken: string): Promise<{ valid: boolean; userId?: string }> {
  const session = await prisma.pending2FASession.findUnique({
    where: { token: pendingToken },
  });

  if (!session) {
    return { valid: false };
  }

  if (session.expiresAt < new Date()) {
    // Delete expired session
    await prisma.pending2FASession.delete({
      where: { token: pendingToken },
    }).catch(() => {});
    return { valid: false };
  }

  return { valid: true, userId: session.userId };
}

export async function clearPendingSession(pendingToken: string): Promise<void> {
  await prisma.pending2FASession.delete({
    where: { token: pendingToken },
  }).catch(() => {
    // Ignore if already deleted
  });
}
