import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditActions } from "@/lib/audit";

// Password requirements (same as signup)
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    };
  }

  if (!PASSWORD_REGEX.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
    };
  }

  return { valid: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing reset token." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Please provide a new password." },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Find the token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      await logAudit({
        action: AuditActions.PASSWORD_RESET_FAILED,
        resource: "user",
        details: { reason: "invalid_token" },
        request: req,
      });

      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (resetToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });

      await logAudit({
        action: AuditActions.PASSWORD_RESET_FAILED,
        resource: "user",
        details: { reason: "token_expired", email: resetToken.email },
        request: req,
      });

      return NextResponse.json(
        { error: "Reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check if token has already been used
    if (resetToken.usedAt) {
      await logAudit({
        action: AuditActions.PASSWORD_RESET_FAILED,
        resource: "user",
        details: { reason: "token_already_used", email: resetToken.email },
        request: req,
      });

      return NextResponse.json(
        { error: "This reset link has already been used. Please request a new one." },
        { status: 400 }
      );
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
      select: { id: true, email: true },
    });

    if (!user) {
      // User may have been deleted since reset was requested
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });

      return NextResponse.json(
        { error: "Account not found. Please contact support." },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user password and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Delete all other reset tokens for this user
      prisma.passwordResetToken.deleteMany({
        where: {
          email: resetToken.email,
          id: { not: resetToken.id },
        },
      }),
    ]);

    // Log successful password reset
    await logAudit({
      userId: user.id,
      action: AuditActions.PASSWORD_RESET_COMPLETED,
      resource: "user",
      resourceId: user.id,
      details: { email: user.email },
      request: req,
    });

    return NextResponse.json({
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}

// GET endpoint to validate token (for UI to show appropriate message)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "No token provided." },
        { status: 400 }
      );
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: {
        expiresAt: true,
        usedAt: true,
        email: true,
      },
    });

    if (!resetToken) {
      return NextResponse.json({
        valid: false,
        error: "Invalid reset link.",
      });
    }

    if (resetToken.usedAt) {
      return NextResponse.json({
        valid: false,
        error: "This reset link has already been used.",
      });
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json({
        valid: false,
        error: "This reset link has expired.",
      });
    }

    // Don't expose the full email, just confirm token is valid
    const maskedEmail = resetToken.email.replace(
      /(.{2})(.*)(@.*)/,
      (_, start, middle, end) => start + "*".repeat(Math.min(middle.length, 5)) + end
    );

    return NextResponse.json({
      valid: true,
      email: maskedEmail,
    });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { valid: false, error: "An error occurred." },
      { status: 500 }
    );
  }
}
