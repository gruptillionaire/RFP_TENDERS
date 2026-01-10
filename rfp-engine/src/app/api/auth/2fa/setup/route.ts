/**
 * /api/auth/2fa/setup
 *
 * POST - Generate TOTP secret and QR code for 2FA setup
 *
 * Returns:
 * - secret: The TOTP secret (to be stored temporarily until verified)
 * - qrCode: Data URL of QR code for authenticator apps
 * - otpauthUrl: Manual entry URL for authenticator apps
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import crypto from "crypto";

// Encryption for storing TOTP secrets
const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "fallback-key-change-in-production";

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if 2FA is already enabled
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is already enabled. Disable it first to set up again." },
        { status: 400 }
      );
    }

    // Generate new TOTP secret
    const secret = new OTPAuth.Secret({ size: 20 });

    // Create TOTP instance
    const totp = new OTPAuth.TOTP({
      issuer: "RFP Engine",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret,
    });

    // Generate QR code
    const otpauthUrl = totp.toString();
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Store encrypted secret temporarily (not enabled yet until verified)
    const encryptedSecret = encrypt(secret.base32);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorSecret: encryptedSecret,
        twoFactorEnabled: false, // Not enabled until verified
      },
    });

    return NextResponse.json({
      secret: secret.base32, // Show to user for manual entry
      qrCode,
      otpauthUrl,
    });
  } catch (error) {
    console.error("2FA setup error:", error);
    return NextResponse.json(
      { error: "Failed to set up 2FA" },
      { status: 500 }
    );
  }
}
