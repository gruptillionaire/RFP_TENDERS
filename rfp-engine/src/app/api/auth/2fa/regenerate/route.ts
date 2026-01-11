/**
 * /api/auth/2fa/regenerate
 *
 * POST - Regenerate backup codes (requires TOTP verification)
 *
 * Body: { code: string } - TOTP code for verification
 *
 * Returns:
 * - success: boolean
 * - backupCodes: string[] (10 new codes)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptTOTPSecret, generateBackupCodes } from "@/lib/crypto";
import * as OTPAuth from "otpauth";
import bcrypt from "bcryptjs";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";
import { rateLimiters, rateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting (5 per hour)
    const rateLimit = rateLimiters.twoFactorRegenerate(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "TOTP code is required for verification" },
        { status: 400 }
      );
    }

    // Get user with 2FA data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        twoFactorSecret: true,
        twoFactorEnabled: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: "2FA is not enabled on this account" },
        { status: 400 }
      );
    }

    // Verify TOTP code
    const secret = decryptTOTPSecret(user.twoFactorSecret);
    const totp = new OTPAuth.TOTP({
      issuer: "RFP Engine",
      label: user.email || "",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });

    if (delta === null) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes(10);

    // Hash backup codes for storage
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c, 10))
    );

    // Update user with new backup codes
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorBackupCodes: hashedBackupCodes,
      },
    });

    // Audit log
    await logAudit({
      userId: session.user.id,
      action: AuditAction.USER_2FA_BACKUP_CODES_REGENERATED,
      resource: AuditResource.USER,
      resourceId: session.user.id,
      request,
    });

    return NextResponse.json({
      success: true,
      backupCodes, // Return plaintext codes once - user must save them
      message:
        "Backup codes have been regenerated. Your old codes are no longer valid.",
    });
  } catch (error) {
    console.error("2FA regenerate error:", error);
    return NextResponse.json(
      { error: "Failed to regenerate backup codes" },
      { status: 500 }
    );
  }
}
