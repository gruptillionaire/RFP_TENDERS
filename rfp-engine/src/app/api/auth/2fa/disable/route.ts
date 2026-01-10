/**
 * /api/auth/2fa/disable
 *
 * POST - Disable 2FA (requires current password or TOTP code)
 *
 * Body: { code: string, password?: string }
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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code, password } = body;

    if (!code && !password) {
      return NextResponse.json(
        { error: "Either TOTP code or password is required" },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is not enabled" },
        { status: 400 }
      );
    }

    let verified = false;

    // Try password verification first
    if (password && user.passwordHash) {
      verified = await bcrypt.compare(password, user.passwordHash);
    }

    // If password didn't work, try TOTP code
    if (!verified && code && user.twoFactorSecret) {
      const secret = decrypt(user.twoFactorSecret);

      const totp = new OTPAuth.TOTP({
        issuer: "RFP Engine",
        label: session.user.email || "",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
      if (delta !== null) {
        verified = true;
      }
    }

    // If still not verified, try backup codes
    if (!verified && code && user.twoFactorBackupCodes.length > 0) {
      const cleanCode = code.replace(/\s/g, "").toUpperCase();
      for (const hashedCode of user.twoFactorBackupCodes) {
        if (await bcrypt.compare(cleanCode, hashedCode)) {
          verified = true;
          break;
        }
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: "Invalid verification. Please check your code or password." },
        { status: 400 }
      );
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
        twoFactorVerifiedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "2FA has been disabled",
    });
  } catch (error) {
    console.error("2FA disable error:", error);
    return NextResponse.json(
      { error: "Failed to disable 2FA" },
      { status: 500 }
    );
  }
}
