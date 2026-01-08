import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { logAudit, AuditActions } from "@/lib/audit";

// Rate limiting for password reset requests (stricter than login)
const resetAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window
const MAX_RESET_ATTEMPTS_PER_EMAIL = 3; // Max 3 requests per email per hour
const MAX_RESET_ATTEMPTS_PER_IP = 10; // Max 10 requests per IP per hour

function checkResetRateLimit(
  identifier: string,
  limit: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = resetAttempts.get(identifier);

  if (!record || record.resetAt < now) {
    resetAttempts.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count };
}

// Token expiration: 1 hour
const TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    // Get IP for rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ||
               req.headers.get("x-real-ip") ||
               "unknown";

    // Check IP rate limit first
    const ipRateLimit = checkResetRateLimit(`ip:${ip}`, MAX_RESET_ATTEMPTS_PER_IP);
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many password reset requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const email = body.email?.toLowerCase().trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Check email-specific rate limit
    const emailRateLimit = checkResetRateLimit(`email:${email}`, MAX_RESET_ATTEMPTS_PER_EMAIL);
    if (!emailRateLimit.allowed) {
      // Don't reveal whether the email exists - return success message anyway
      // But log it for monitoring
      console.log(`Rate limited password reset for: ${email}`);
    }

    // Always return success message to prevent email enumeration
    // Even if the email doesn't exist or is rate limited
    const successResponse = NextResponse.json({
      message: "If an account exists with this email, you will receive a password reset link shortly.",
    });

    // If rate limited, return early but with success message
    if (!emailRateLimit.allowed) {
      return successResponse;
    }

    // Check if user exists (but don't reveal this to the client)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });

    // Only proceed if user exists and has a password (not OAuth-only)
    if (!user || !user.passwordHash) {
      // Log the attempt but don't reveal to user
      await logAudit({
        action: AuditActions.PASSWORD_RESET_REQUESTED,
        resource: "user",
        details: { email, found: false },
        request: req,
      });
      return successResponse;
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

    // Delete any existing tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });

    // Create new token
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expiresAt,
      },
    });

    // Send email
    const emailResult = await sendPasswordResetEmail(email, token);

    // Log the action
    await logAudit({
      userId: user.id,
      action: AuditActions.PASSWORD_RESET_REQUESTED,
      resource: "user",
      resourceId: user.id,
      details: { emailSent: emailResult.success },
      request: req,
    });

    if (!emailResult.success) {
      console.error("Failed to send password reset email:", emailResult.error);
      // Still return success to prevent enumeration
    }

    return successResponse;
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
