/**
 * POST /api/admin/referrals/generate
 *
 * Admin-only endpoint to generate a referral code for a user.
 *
 * SECURITY:
 * - Requires authenticated user
 * - User must be in ADMIN_EMAILS environment variable
 *
 * Request body:
 * - email: string - The email of the user to give a referral code
 *
 * Returns the generated referral code and full referral link.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

// Get admin emails from environment variable (comma-separated)
function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS || "";
  return adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(email: string): boolean {
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

// Generate a unique referral code (6 alphanumeric chars)
function generateReferralCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        referralCode: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user already has a referral code
    if (user.referralCode) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rfpmatrix.com";
      return NextResponse.json({
        message: "User already has a referral code",
        user: {
          email: user.email,
          name: user.name,
          referralCode: user.referralCode,
          referralLink: `${baseUrl}/signup?ref=${user.referralCode}`,
        },
      });
    }

    // Generate a unique referral code (retry if collision)
    let newCode: string;
    let attempts = 0;
    do {
      newCode = generateReferralCode();
      const existing = await prisma.user.findUnique({
        where: { referralCode: newCode },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "Failed to generate unique code, please try again" },
        { status: 500 }
      );
    }

    // Update user with new referral code
    await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: newCode },
    });

    // Audit log
    await logAudit({
      userId: session.user.id,
      action: AuditAction.USER_PROFILE_UPDATE,
      resource: AuditResource.USER,
      resourceId: user.id,
      details: {
        action: "referral_code_generated",
        targetEmail: user.email,
        referralCode: newCode,
        adminEmail: session.user.email,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rfpmatrix.com";

    console.log(
      `Admin ${session.user.email} generated referral code ${newCode} for ${user.email}`
    );

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        referralCode: newCode,
        referralLink: `${baseUrl}/signup?ref=${newCode}`,
      },
    });
  } catch (error) {
    console.error("Error generating referral code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
