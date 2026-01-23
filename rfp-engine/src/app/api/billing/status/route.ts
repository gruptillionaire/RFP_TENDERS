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
import { PLAN_CONFIG, getPlanLimits, type PlanType } from "@/lib/stripe";

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
        monthlyDraftsUsed: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        // Single-use credits
        singleUseExtractionsRemaining: true,
        singleUseDraftsRemaining: true,
        singleUseExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if this is an expired granted subscription (no Stripe ID, past currentPeriodEnd)
    const isGrantedSubscription =
      ["STARTER", "PRO", "BUSINESS"].includes(user.plan) && !user.stripeSubscriptionId;
    const grantExpired =
      isGrantedSubscription &&
      user.currentPeriodEnd &&
      new Date() > user.currentPeriodEnd;

    // Use effective plan for expired grants
    const effectivePlan = grantExpired ? "FREE" : user.plan;

    // Get plan details and limits based on effective plan
    const planConfig = effectivePlan !== "FREE" ? PLAN_CONFIG[effectivePlan as PlanType] : null;
    const planLimits = getPlanLimits(effectivePlan);

    // Calculate single-use status
    const singleUseExpired = user.singleUseExpiresAt
      ? new Date() > user.singleUseExpiresAt
      : false;
    const singleUseHasCredits =
      user.singleUseExtractionsRemaining > 0 && !singleUseExpired;

    return NextResponse.json({
      plan: effectivePlan,
      planName: planConfig?.name || "No Subscription",
      subscriptionStatus: grantExpired ? null : user.subscriptionStatus,
      currentPeriodEnd: grantExpired ? null : user.currentPeriodEnd?.toISOString() || null,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      usage: {
        extractionsUsed: user.monthlyExtractionsUsed,
        extractionsLimit: planLimits.monthlyExtractions,
        draftsUsed: user.monthlyDraftsUsed,
        draftsLimit: planLimits.monthlyDrafts,
      },
      hasStripeAccount: !!user.stripeCustomerId,
      features: planConfig?.features || [
        "Subscribe to unlock features",
      ],
      limits: {
        canExportWord: planLimits.canExportWord,
        canUseLibrary: planLimits.canUseLibrary,
      },
      // Single-use credits (separate from subscription)
      singleUse: {
        hasCredits: singleUseHasCredits,
        extractionsRemaining: singleUseExpired ? 0 : user.singleUseExtractionsRemaining,
        draftsRemaining: singleUseExpired ? 0 : user.singleUseDraftsRemaining,
        expiresAt: user.singleUseExpiresAt?.toISOString() || null,
        isExpired: singleUseExpired,
      },
    });
  } catch (error) {
    console.error("Billing status error:", error);
    return NextResponse.json(
      { error: "Failed to get billing status" },
      { status: 500 }
    );
  }
}
