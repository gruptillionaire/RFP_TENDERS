/**
 * POST /api/billing/webhook
 *
 * Handles Stripe webhook events for subscription lifecycle.
 *
 * SECURITY CRITICAL:
 * - Verifies webhook signature using STRIPE_WEBHOOK_SECRET
 * - Rejects requests without valid signature
 * - Processes raw body to prevent signature mismatch
 * - Idempotent event handling to prevent duplicate processing
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  constructWebhookEvent,
  getPlanFromPriceId,
  mapSubscriptionStatus,
  getPlanLimits,
  SINGLE_USE_CONFIG,
} from "@/lib/stripe";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";
import type Stripe from "stripe";
import { sendSubscriptionStartedEmail, sendSubscriptionCancelledEmail, sendPaymentFailedEmail } from "@/lib/email";

// Disable body parsing to get raw body for signature verification
export const dynamic = "force-dynamic";

/**
 * Check if event has already been processed (database-backed idempotency)
 * This is critical for serverless environments where in-memory state is lost
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.processedWebhookEvent.findUnique({
    where: { id: eventId },
  });
  return !!existing;
}

/**
 * Mark event as processed in database
 */
async function markEventProcessed(eventId: string): Promise<void> {
  await prisma.processedWebhookEvent.create({
    data: { id: eventId },
  }).catch((err) => {
    // Ignore unique constraint violation (concurrent processing)
    if (err.code !== "P2002") throw err;
  });
}

/**
 * Clean up old processed events (run periodically)
 * Keeps events from the last 7 days
 */
async function cleanupOldEvents(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.processedWebhookEvent.deleteMany({
    where: { createdAt: { lt: sevenDaysAgo } },
  }).catch(() => {
    // Ignore cleanup errors
  });
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("Webhook error: Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Database-backed idempotency check
    if (await isEventProcessed(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true });
    }

    // Mark as processed before processing (prevents concurrent duplicates)
    await markEventProcessed(event.id);

    // Clean up old events periodically (run in background)
    cleanupOldEvents();

    console.log(`Processing webhook event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * This fires when a customer completes the checkout flow
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;

  // Check if this is a single-use purchase
  if (session.metadata?.type === "single_use") {
    await handleSingleUsePurchase(session);
    return;
  }

  // Handle subscription checkout
  const subscriptionId = session.subscription as string;

  if (!customerId || !subscriptionId) {
    console.error("Checkout session missing customer or subscription ID");
    return;
  }

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  // Update user with subscription ID
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscriptionId,
    },
  });

  await logAudit({
    userId: user.id,
    action: AuditAction.BILLING_CHECKOUT_COMPLETED,
    resource: AuditResource.SUBSCRIPTION,
    resourceId: subscriptionId,
    details: {
      customerId,
      sessionId: session.id,
    },
  });

  console.log(`Checkout completed for user ${user.id}`);
}

/**
 * Handle single-use purchase completion
 * Credits user with 1 extraction and 60 drafts, sets 30-day expiration
 */
async function handleSingleUsePurchase(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const paymentIntentId = session.payment_intent as string;

  if (!customerId || !paymentIntentId) {
    console.error("Single-use checkout missing customer or payment intent ID");
    return;
  }

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  // Calculate expiration date (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SINGLE_USE_CONFIG.limits.expirationDays);

  // Update user with single-use credits and create purchase record
  await prisma.$transaction([
    // Update user credits
    prisma.user.update({
      where: { id: user.id },
      data: {
        singleUseExtractionsRemaining: { increment: SINGLE_USE_CONFIG.limits.extractions },
        singleUseDraftsRemaining: { increment: SINGLE_USE_CONFIG.limits.drafts },
        singleUsePurchasedAt: new Date(),
        singleUseExpiresAt: expiresAt,
        singleUseStripePaymentId: paymentIntentId,
      },
    }),
    // Create purchase record for audit trail
    prisma.singleUsePurchase.create({
      data: {
        userId: user.id,
        stripePaymentId: paymentIntentId,
        amount: session.amount_total || (SINGLE_USE_CONFIG.price * 100),
        currency: session.currency || "gbp",
        extractionsGranted: SINGLE_USE_CONFIG.limits.extractions,
        draftsGranted: SINGLE_USE_CONFIG.limits.drafts,
        status: "completed",
      },
    }),
  ]);

  await logAudit({
    userId: user.id,
    action: AuditAction.BILLING_PAYMENT_SUCCEEDED,
    resource: AuditResource.SUBSCRIPTION,
    resourceId: paymentIntentId,
    details: {
      type: "single_use",
      extractionsGranted: SINGLE_USE_CONFIG.limits.extractions,
      draftsGranted: SINGLE_USE_CONFIG.limits.drafts,
      expiresAt: expiresAt.toISOString(),
    },
  });

  console.log(`Single-use purchase completed for user ${user.id}: ${SINGLE_USE_CONFIG.limits.extractions} extractions, ${SINGLE_USE_CONFIG.limits.drafts} drafts, expires ${expiresAt.toISOString()}`);
}

/**
 * Handle subscription created/updated
 * This fires when subscription status changes
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;

  // Find user by customer ID or subscription ID
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { stripeCustomerId: customerId },
        { stripeSubscriptionId: subscriptionId },
      ],
    },
  });

  if (!user) {
    console.error(`No user found for subscription ${subscriptionId}`);
    return;
  }

  // Get the subscription item to access price and period info
  const subscriptionItem = subscription.items.data[0];
  if (!subscriptionItem) {
    console.error("Subscription has no items");
    return;
  }

  const priceId = subscriptionItem.price?.id;
  if (!priceId) {
    console.error("Subscription item has no price ID");
    return;
  }

  // Map price ID to plan
  const plan = getPlanFromPriceId(priceId);
  if (!plan) {
    console.error(`Unknown price ID: ${priceId}`);
    return;
  }

  // Get plan limits for quota updates
  const limits = getPlanLimits(plan);

  // Get current period end from the subscription item
  const currentPeriodEnd = subscriptionItem.current_period_end
    ? new Date(subscriptionItem.current_period_end * 1000)
    : null;

  // Update user record
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      subscriptionStatus: mapSubscriptionStatus(subscription.status),
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      // Update limits based on new plan
      monthlyExtractionsLimit: limits.monthlyExtractions === -1 ? 999999 : limits.monthlyExtractions,
    },
  });

  await logAudit({
    userId: user.id,
    action: AuditAction.BILLING_SUBSCRIPTION_UPDATED,
    resource: AuditResource.SUBSCRIPTION,
    resourceId: subscriptionId,
    details: {
      plan,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: currentPeriodEnd?.toISOString() || null,
    },
  });

  // Send welcome email for new active subscriptions (user upgrading from FREE)
  if (subscription.status === "active" && user.plan === "FREE" && user.email) {
    const planNames: Record<string, string> = {
      STARTER: "Starter",
      PRO: "Pro",
      BUSINESS: "Business",
      ENTERPRISE: "Enterprise",
    };
    sendSubscriptionStartedEmail(user.email, planNames[plan] || plan).catch((err) =>
      console.error("Failed to send subscription started email:", err)
    );
  }

  console.log(`Subscription updated for user ${user.id}: ${plan} (${subscription.status})`);
}

/**
 * Handle subscription deleted
 * This fires when a subscription is fully cancelled
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { stripeCustomerId: customerId },
        { stripeSubscriptionId: subscriptionId },
      ],
    },
  });

  if (!user) {
    console.error(`No user found for cancelled subscription ${subscriptionId}`);
    return;
  }

  // Revert to FREE plan
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: "FREE",
      subscriptionStatus: "CANCELED",
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null, // Clear subscription ID
      // Reset to free tier limits
      monthlyExtractionsLimit: 0,
    },
  });

  await logAudit({
    userId: user.id,
    action: AuditAction.BILLING_SUBSCRIPTION_CANCELLED,
    resource: AuditResource.SUBSCRIPTION,
    resourceId: subscriptionId,
    details: {
      previousPlan: user.plan,
    },
  });

  // Send cancellation email
  if (user.email && user.plan !== "FREE") {
    const planNames: Record<string, string> = {
      STARTER: "Starter",
      PRO: "Pro",
      BUSINESS: "Business",
      ENTERPRISE: "Enterprise",
    };
    const endDate = user.currentPeriodEnd
      ? user.currentPeriodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "today";
    sendSubscriptionCancelledEmail(user.email, planNames[user.plan] || user.plan, endDate).catch((err) =>
      console.error("Failed to send subscription cancelled email:", err)
    );
  }

  console.log(`Subscription cancelled for user ${user.id}, reverted to FREE`);
}

/**
 * Handle successful payment
 * This fires when an invoice is paid
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Check if this is a subscription invoice (new API structure)
  const subscriptionDetails = invoice.parent?.subscription_details;
  if (!subscriptionDetails) {
    // One-time payment, not subscription
    return;
  }

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  // Reset monthly usage on successful payment (new billing cycle)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      monthlyExtractionsUsed: 0,
      lastUsageReset: new Date(),
      subscriptionStatus: "ACTIVE",
    },
  });

  await logAudit({
    userId: user.id,
    action: AuditAction.BILLING_PAYMENT_SUCCEEDED,
    resource: AuditResource.INVOICE,
    resourceId: invoice.id,
    details: {
      amount: invoice.amount_paid,
      currency: invoice.currency,
    },
  });

  console.log(`Payment succeeded for user ${user.id}`);
}

/**
 * Handle failed payment
 * This fires when an invoice payment fails
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Check if this is a subscription invoice (new API structure)
  const subscriptionDetails = invoice.parent?.subscription_details;
  if (!subscriptionDetails) {
    // One-time payment, not subscription
    return;
  }

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  // Update subscription status to past_due
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: "PAST_DUE",
    },
  });

  await logAudit({
    userId: user.id,
    action: AuditAction.BILLING_PAYMENT_FAILED,
    resource: AuditResource.INVOICE,
    resourceId: invoice.id,
    details: {
      amount: invoice.amount_due,
      currency: invoice.currency,
      attemptCount: invoice.attempt_count,
    },
  });

  console.log(`Payment failed for user ${user.id} (attempt ${invoice.attempt_count})`);

  // Send email notification about failed payment
  if (user.email) {
    const planNames: Record<string, string> = {
      STARTER: "Starter",
      PRO: "Pro",
      BUSINESS: "Business",
      ENTERPRISE: "Enterprise",
    };
    const planName = planNames[user.plan] || user.plan;

    // Format amount (Stripe amounts are in cents)
    const amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.currency.toUpperCase(),
    }).format(invoice.amount_due / 100);

    // Link to settings page where they can access billing portal
    const updatePaymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://rfpmatrix.com"}/settings`;

    sendPaymentFailedEmail(user.email, planName, amount, updatePaymentUrl).catch((err) =>
      console.error("Failed to send payment failed email:", err)
    );
  }
}
