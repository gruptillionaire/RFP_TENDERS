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
} from "@/lib/stripe";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";
import type Stripe from "stripe";

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
      monthlyExtractionsLimit: 2,
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

  // TODO: Send email notification about failed payment
}
