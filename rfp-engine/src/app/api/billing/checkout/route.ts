/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for subscription signup or single-use purchase.
 *
 * SECURITY:
 * - Requires authenticated user
 * - Validates plan parameter against allowed values
 * - Links checkout to authenticated user's email
 * - Rate limited to prevent abuse
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateCustomer,
  createCheckoutSession,
  createSingleUseCheckoutSession,
  PLAN_CONFIG,
  SINGLE_USE_CONFIG,
  type PlanType,
} from "@/lib/stripe";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

// Rate limiting: max 5 checkout attempts per user per hour
const checkoutAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = checkoutAttempts.get(userId);

  if (!record || now > record.resetAt) {
    checkoutAttempts.set(userId, { count: 1, resetAt: now + 3600000 }); // 1 hour
    return true;
  }

  if (record.count >= 5) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { plan, type } = body;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        plan: true,
        singleUseExtractionsRemaining: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await getOrCreateCustomer(user.id, user.email, user.name);

      // Save customer ID to user record
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Handle single-use purchase
    if (type === "single_use") {
      // Check if price is configured
      if (!SINGLE_USE_CONFIG.priceId) {
        console.error("Missing Stripe price ID for single-use. Set STRIPE_SINGLE_USE_PRICE_ID environment variable.");
        return NextResponse.json(
          { error: "Single RFP purchase is not configured yet. Please contact support." },
          { status: 500 }
        );
      }

      // Check if user already has unused single-use credits
      if (user.singleUseExtractionsRemaining > 0) {
        return NextResponse.json(
          { error: "You still have unused single-use credits. Please use them before purchasing more." },
          { status: 400 }
        );
      }

      const successUrl = `${baseUrl}/dashboard?purchase=success&type=single_use`;
      const cancelUrl = `${baseUrl}/pricing?purchase=cancelled`;

      const checkoutSession = await createSingleUseCheckoutSession(
        customerId,
        successUrl,
        cancelUrl
      );

      await logAudit({
        userId: user.id,
        action: AuditAction.BILLING_CHECKOUT_CREATED,
        resource: AuditResource.SUBSCRIPTION,
        details: {
          type: "single_use",
          checkoutSessionId: checkoutSession.id,
        },
        request,
      });

      return NextResponse.json({
        url: checkoutSession.url,
        sessionId: checkoutSession.id,
      });
    }

    // Handle subscription checkout
    const validPlans: PlanType[] = ["STARTER", "PRO", "TEAM", "BUSINESS"];
    if (!plan || !validPlans.includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be STARTER, PRO, TEAM, or BUSINESS." },
        { status: 400 }
      );
    }

    const planConfig = PLAN_CONFIG[plan as PlanType];
    if (!planConfig.priceId) {
      console.error(`Missing Stripe price ID for plan: ${plan}. Set STRIPE_${plan}_PRICE_ID environment variable.`);
      return NextResponse.json(
        { error: `The ${plan} plan is not configured yet. Please contact support.` },
        { status: 500 }
      );
    }

    // Prevent creating checkout if already on paid plan
    if (user.plan !== "FREE") {
      return NextResponse.json(
        {
          error: "You already have an active subscription. Use the billing portal to manage it.",
        },
        { status: 400 }
      );
    }

    const successUrl = `${baseUrl}/dashboard?subscription=success`;
    const cancelUrl = `${baseUrl}/pricing?subscription=cancelled`;

    // Create checkout session
    const checkoutSession = await createCheckoutSession(
      customerId,
      planConfig.priceId,
      successUrl,
      cancelUrl
    );

    // Audit log
    await logAudit({
      userId: user.id,
      action: AuditAction.BILLING_CHECKOUT_CREATED,
      resource: AuditResource.SUBSCRIPTION,
      details: {
        plan,
        checkoutSessionId: checkoutSession.id,
      },
      request,
    });

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    );
  }
}
