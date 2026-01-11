/**
 * GET /api/billing/status
 *
 * Returns current user's billing/subscription status.
 * Used by frontend to display subscription info and control feature access.
 *
 * SECURITY:
 * - Requires authenticated user
 * - Only returns user's own billing data
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_CONFIG, type PlanType } from "@/lib/stripe";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        monthlyExtractionsUsed: true,
        monthlyExtractionsLimit: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get plan details
    const planConfig = user.plan !== "FREE" ? PLAN_CONFIG[user.plan as PlanType] : null;

    return NextResponse.json({
      plan: user.plan,
      planName: planConfig?.name || "No Subscription",
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd?.toISOString() || null,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      usage: {
        extractionsUsed: user.monthlyExtractionsUsed,
        extractionsLimit: user.monthlyExtractionsLimit,
      },
      hasStripeAccount: !!user.stripeCustomerId,
      features: planConfig?.features || [
        "Subscribe to unlock features",
      ],
    });
  } catch (error) {
    console.error("Billing status error:", error);
    return NextResponse.json(
      { error: "Failed to get billing status" },
      { status: 500 }
    );
  }
}
