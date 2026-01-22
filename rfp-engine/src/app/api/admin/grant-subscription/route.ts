/**
 * POST /api/admin/grant-subscription
 *
 * Admin-only endpoint to grant a free subscription to any user.
 * Used for promotional offers, partnerships, or customer support.
 *
 * SECURITY:
 * - Requires authenticated user
 * - User must be in ADMIN_EMAILS environment variable
 * - Audit logged for compliance
 *
 * Request body:
 * - email: string - The email of the user to upgrade
 * - plan: "STARTER" | "PRO" | "BUSINESS" - The plan to grant
 * - durationMonths: number - How many months to grant (1-24)
 * - reason?: string - Optional reason for the grant (stored in audit log)
 *
 * Example:
 * POST /api/admin/grant-subscription
 * {
 *   "email": "user@example.com",
 *   "plan": "PRO",
 *   "durationMonths": 3,
 *   "reason": "Beta tester reward"
 * }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";
import { getPlanLimits } from "@/lib/stripe";

// Valid plans that can be granted (not FREE or ENTERPRISE)
const GRANTABLE_PLANS = ["STARTER", "PRO", "BUSINESS"] as const;
type GrantablePlan = (typeof GRANTABLE_PLANS)[number];

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

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is an admin
    if (!isAdmin(session.user.email)) {
      console.warn(
        `Non-admin user ${session.user.email} attempted to access grant-subscription endpoint`
      );
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, plan, durationMonths, reason } = body;

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate plan
    if (!plan || !GRANTABLE_PLANS.includes(plan)) {
      return NextResponse.json(
        {
          error: `Invalid plan. Must be one of: ${GRANTABLE_PLANS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate duration
    const months = Number(durationMonths);
    if (!months || months < 1 || months > 24 || !Number.isInteger(months)) {
      return NextResponse.json(
        { error: "Duration must be an integer between 1 and 24 months" },
        { status: 400 }
      );
    }

    // Find the user to upgrade
    const targetUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        stripeSubscriptionId: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Warn if user has an active Stripe subscription
    if (targetUser.stripeSubscriptionId && targetUser.subscriptionStatus === "ACTIVE") {
      return NextResponse.json(
        {
          error:
            "User has an active Stripe subscription. Cancel it first via Stripe dashboard, or use the billing portal.",
        },
        { status: 400 }
      );
    }

    const previousPlan = targetUser.plan;
    const previousStatus = targetUser.subscriptionStatus;
    const previousPeriodEnd = targetUser.currentPeriodEnd;

    // Calculate end date
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    // Get plan limits
    const planLimits = getPlanLimits(plan as GrantablePlan);

    // Update user to the granted plan
    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        plan: plan as GrantablePlan,
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: endDate,
        cancelAtPeriodEnd: false,
        // Set limits based on plan
        monthlyExtractionsLimit: planLimits.monthlyExtractions,
        // Reset usage counters for fresh start
        monthlyExtractionsUsed: 0,
        monthlyDraftsUsed: 0,
        lastUsageReset: new Date(),
        // Clear any Stripe subscription ID since this is a free grant
        // (Keep stripeCustomerId for future purchases)
        stripeSubscriptionId: null,
      },
    });

    // Audit log the action
    await logAudit({
      userId: session.user.id,
      action: AuditAction.BILLING_SUBSCRIPTION_UPDATED,
      resource: AuditResource.USER,
      resourceId: targetUser.id,
      details: {
        action: "admin_grant_subscription",
        targetEmail: email,
        previousPlan,
        previousStatus,
        previousPeriodEnd: previousPeriodEnd?.toISOString() || null,
        newPlan: plan,
        durationMonths: months,
        expiresAt: endDate.toISOString(),
        reason: reason || null,
        adminEmail: session.user.email,
        grantType: "free_subscription",
      },
    });

    console.log(
      `Admin ${session.user.email} granted ${months}-month ${plan} subscription to ${email} (expires: ${endDate.toISOString()})`
    );

    return NextResponse.json({
      success: true,
      message: `Granted ${months}-month ${plan} subscription to ${email}`,
      user: {
        email: targetUser.email,
        previousPlan,
        newPlan: plan,
        durationMonths: months,
        expiresAt: endDate.toISOString(),
        limits: {
          monthlyExtractions: planLimits.monthlyExtractions,
          monthlyDrafts: planLimits.monthlyDrafts,
          canUseLibrary: planLimits.canUseLibrary,
          canExportWord: planLimits.canExportWord,
        },
      },
    });
  } catch (error) {
    console.error("Error granting subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to list all granted (non-Stripe) subscriptions
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find users with active subscriptions but no Stripe subscription ID
    // These are the manually granted free subscriptions
    const grantedUsers = await prisma.user.findMany({
      where: {
        plan: { in: ["STARTER", "PRO", "BUSINESS"] },
        subscriptionStatus: "ACTIVE",
        stripeSubscriptionId: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        currentPeriodEnd: true,
        createdAt: true,
        monthlyExtractionsUsed: true,
        monthlyExtractionsLimit: true,
        monthlyDraftsUsed: true,
      },
      orderBy: { currentPeriodEnd: "asc" },
    });

    // Also get recent audit logs for grant actions
    const recentGrants = await prisma.auditLog.findMany({
      where: {
        details: {
          path: ["action"],
          equals: "admin_grant_subscription",
        },
      },
      select: {
        id: true,
        userId: true,
        resourceId: true,
        details: true,
        createdAt: true,
        user: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      activeGrants: {
        count: grantedUsers.length,
        users: grantedUsers.map((u) => ({
          ...u,
          isExpired: u.currentPeriodEnd ? new Date() > u.currentPeriodEnd : false,
          daysRemaining: u.currentPeriodEnd
            ? Math.max(
                0,
                Math.ceil(
                  (u.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
              )
            : 0,
        })),
      },
      recentGrants: recentGrants.map((log) => ({
        id: log.id,
        grantedBy: log.user?.email,
        grantedTo: (log.details as Record<string, unknown>)?.targetEmail,
        plan: (log.details as Record<string, unknown>)?.newPlan,
        durationMonths: (log.details as Record<string, unknown>)?.durationMonths,
        reason: (log.details as Record<string, unknown>)?.reason,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching granted subscriptions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
