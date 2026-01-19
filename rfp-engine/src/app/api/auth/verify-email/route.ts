/**
 * /api/auth/verify-email
 *
 * POST - Verify email with token
 *
 * Body: { token: string }
 *
 * Validates the token, marks user as verified, and marks token as used.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, error: "Verification token is required" },
        { status: 400 }
      );
    }

    // Find the token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired verification link" },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (verificationToken.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "Verification link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check if token has already been used
    if (verificationToken.usedAt) {
      return NextResponse.json(
        { success: false, error: "This verification link has already been used" },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.email },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      // Mark token as used anyway to prevent reuse
      await prisma.emailVerificationToken.update({
        where: { token },
        data: { usedAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        alreadyVerified: true,
        message: "Your email is already verified",
      });
    }

    // Verify the user and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);

    // Audit log
    await logAudit({
      userId: user.id,
      action: AuditAction.USER_EMAIL_VERIFIED,
      resource: AuditResource.USER,
      resourceId: user.id,
      request,
    });

    // Clean up expired tokens (run in background)
    prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    }).catch(() => {
      // Ignore cleanup errors
    });

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { success: false, error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
