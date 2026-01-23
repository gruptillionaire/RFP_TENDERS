/**
 * GET /api/admin/referrals
 *
 * Admin-only endpoint to view referral tracking data.
 *
 * SECURITY:
 * - Requires authenticated user
 * - User must be in ADMIN_EMAILS environment variable
 *
 * Returns:
 * - List of all referral conversions (who referred who, when they paid)
 * - Summary stats (total referrals, total conversions)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all conversions with referrer details
    const conversions = await prisma.referralConversion.findMany({
      orderBy: { convertedAt: "desc" },
      include: {
        referrer: {
          select: {
            email: true,
            name: true,
            referralCode: true,
          },
        },
      },
    });

    // Get all users who have referred someone (even if not converted yet)
    const referrers = await prisma.user.findMany({
      where: {
        referredUsers: {
          some: {},
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        referralCode: true,
        _count: {
          select: {
            referredUsers: true,
            referralConversions: true,
          },
        },
        referredUsers: {
          select: {
            id: true,
            email: true,
            plan: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: {
        referredUsers: {
          _count: "desc",
        },
      },
    });

    // Calculate summary stats
    const totalReferrals = await prisma.user.count({
      where: {
        referredByUserId: { not: null },
      },
    });

    const totalConversions = conversions.length;

    return NextResponse.json({
      summary: {
        totalReferrals,
        totalConversions,
        conversionRate: totalReferrals > 0
          ? Math.round((totalConversions / totalReferrals) * 100)
          : 0,
      },
      conversions: conversions.map((c) => ({
        id: c.id,
        referrerEmail: c.referrer.email,
        referrerName: c.referrer.name,
        referrerCode: c.referrer.referralCode,
        refereeEmail: c.refereeEmail,
        plan: c.plan,
        convertedAt: c.convertedAt.toISOString(),
      })),
      referrers: referrers.map((r) => ({
        email: r.email,
        name: r.name,
        referralCode: r.referralCode,
        totalReferred: r._count.referredUsers,
        totalConverted: r._count.referralConversions,
        referredUsers: r.referredUsers.map((u) => ({
          email: u.email,
          plan: u.plan,
          signedUpAt: u.createdAt.toISOString(),
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching referrals:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
