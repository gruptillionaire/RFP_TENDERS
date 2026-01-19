/**
 * /api/auth/resend-verification
 *
 * POST - Resend email verification link
 *
 * Requires authenticated user.
 * Rate limited: 3 per hour per email.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimiters } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        alreadyVerified: true,
        message: "Your email is already verified",
      });
    }

    // Rate limiting: 3 per hour per email
    const rateLimit = await rateLimiters.emailVerificationResend(user.email);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Delete any existing unused tokens for this email
    await prisma.emailVerificationToken.deleteMany({
      where: {
        email: user.email,
        usedAt: null,
      },
    });

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new verification token
    const created = await prisma.emailVerificationToken.create({
      data: {
        email: user.email,
        token: verificationToken,
        expiresAt: tokenExpiresAt,
      },
    });

    console.log("[resend-verification] Token created:", {
      id: created.id,
      email: created.email,
      tokenPrefix: verificationToken.substring(0, 16) + "...",
      tokenLength: verificationToken.length,
    });

    // Send verification email
    await sendVerificationEmail({
      email: user.email,
      userName: user.name,
      verificationToken,
    });

    console.log("[resend-verification] Email sent to:", user.email);

    return NextResponse.json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send verification email. Please try again." },
      { status: 500 }
    );
  }
}
