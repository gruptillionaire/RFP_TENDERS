/**
 * /api/auth/change-password
 *
 * POST - Change password for authenticated user
 *
 * Body: { currentPassword: string, newPassword: string }
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimiters, rateLimitHeaders } from "@/lib/rate-limit";
import { logAudit, AuditActions } from "@/lib/audit";
import { sendPasswordChangedEmail } from "@/lib/email";

// Password requirements (same as signup/reset)
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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting - sensitive action
    const rateLimit = rateLimiters.passwordChange(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many password change attempts. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json(
        { error: "Current password is required." },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "New password is required." },
        { status: 400 }
      );
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Prevent using the same password
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from current password." },
        { status: 400 }
      );
    }

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Check if user has a password (OAuth users may not)
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Cannot change password for accounts using social login." },
        { status: 400 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      await logAudit({
        userId: user.id,
        action: AuditActions.USER_PASSWORD_CHANGE,
        resource: "user",
        resourceId: user.id,
        details: { success: false, reason: "invalid_current_password" },
        request,
      });

      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 }
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    // Log successful password change
    await logAudit({
      userId: user.id,
      action: AuditActions.USER_PASSWORD_CHANGE,
      resource: "user",
      resourceId: user.id,
      details: { success: true },
      request,
    });

    // Send notification email (don't await - fire and forget)
    sendPasswordChangedEmail(user.email).catch((err) =>
      console.error("Failed to send password changed email:", err)
    );

    return NextResponse.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "Failed to change password. Please try again." },
      { status: 500 }
    );
  }
}
