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
import * as OTPAuth from "otpauth";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "fallback-key-change-in-production";

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(code);
  }
  return codes;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const secret = decrypt(user.twoFactorSecret);

    const totp = new OTPAuth.TOTP({
      issuer: "RFP Engine",
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
