/**
 * Stripe Configuration and Utilities
 *
 * SECURITY NOTES:
 * - Stripe secret key is only used server-side
 * - Webhook signature verification required for all events
 * - Customer IDs tied to authenticated users only
 */

import Stripe from "stripe";

// Lazy initialization to prevent build errors when env vars missing
let stripeInstance: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return stripeInstance;
}

export { getStripeClient };

// Plan configuration with price IDs
// IMPORTANT: These must match your Stripe Dashboard price IDs
// Warn if price IDs are not configured (only in development)
if (process.env.NODE_ENV === "development") {
  if (!process.env.STRIPE_SOLO_PRICE_ID) console.warn("Warning: STRIPE_SOLO_PRICE_ID not set - checkout will fail for Solo plan");
  if (!process.env.STRIPE_PRO_PRICE_ID) console.warn("Warning: STRIPE_PRO_PRICE_ID not set - checkout will fail for Pro plan");
  if (!process.env.STRIPE_TEAM_PRICE_ID) console.warn("Warning: STRIPE_TEAM_PRICE_ID not set - checkout will fail for Team plan");
}

export const PLAN_CONFIG = {
  SOLO: {
    name: "Solo",
    priceId: process.env.STRIPE_SOLO_PRICE_ID || "",
    monthlyPrice: 39,
    currency: "gbp",
    features: [
      "5 RFP extractions per month",
      "100 AI draft responses per month",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word",
    ],
    limits: {
      monthlyExtractions: 5,
      activeProjects: 5,
      monthlyDrafts: 100,
      storedResponses: 50,
    },
  },
  PRO: {
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    monthlyPrice: 99,
    currency: "gbp",
    features: [
      "15 RFP extractions per month",
      "500 AI draft responses per month",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word",
      "Priority support",
    ],
    limits: {
      monthlyExtractions: 15,
      activeProjects: 10,
      monthlyDrafts: 500,
      storedResponses: 200,
    },
  },
  TEAM: {
    name: "Team",
    priceId: process.env.STRIPE_TEAM_PRICE_ID || "",
    monthlyPrice: 249,
    currency: "gbp",
    features: [
      "Unlimited RFP extractions",
      "Unlimited AI draft responses",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word",
      "Priority support",
    ],
    limits: {
      monthlyExtractions: -1, // -1 = unlimited
      activeProjects: -1,
      monthlyDrafts: -1,
      storedResponses: -1,
    },
  },
} as const;

export type PlanType = keyof typeof PLAN_CONFIG;

// Map Stripe price ID to plan type
export function getPlanFromPriceId(priceId: string): PlanType | null {
  for (const [plan, config] of Object.entries(PLAN_CONFIG)) {
    if (config.priceId === priceId) {
      return plan as PlanType;
    }
  }
  return null;
}

// Get plan limits for quota enforcement
export function getPlanLimits(plan: string) {
  if (plan === "FREE") {
    return {
      monthlyExtractions: 2,
      activeProjects: 2,
      monthlyDrafts: 20,
      storedResponses: 10,
    };
  }
  return PLAN_CONFIG[plan as PlanType]?.limits || PLAN_CONFIG.SOLO.limits;
}

// Create or retrieve Stripe customer
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string | null
): Promise<string> {
  const stripe = getStripeClient();

  // First check if customer already exists
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // Create new customer with metadata linking to our user
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      userId, // Link to our internal user ID
    },
  });

  return customer.id;
}

// Create checkout session for subscription
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Allow promotion codes
    allow_promotion_codes: true,
    // Collect billing address for tax compliance
    billing_address_collection: "required",
    // Automatic tax calculation (if configured in Stripe)
    automatic_tax: { enabled: true },
    // Customer can update payment method
    payment_method_collection: "always",
    // Subscription data
    subscription_data: {
      metadata: {
        customerId,
      },
    },
  });

  return session;
}

// Create billing portal session for subscription management
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

// Get subscription details
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  const stripe = getStripeClient();

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    return null;
  }
}

// Cancel subscription at period end (graceful cancellation)
export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();

  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

// Reactivate a subscription that was set to cancel
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();

  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

// Webhook signature verification
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// Map Stripe subscription status to our enum
export function mapSubscriptionStatus(
  status: Stripe.Subscription.Status
): "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "TRIALING" | "INCOMPLETE" | "INCOMPLETE_EXPIRED" {
  const statusMap: Record<Stripe.Subscription.Status, "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "TRIALING" | "INCOMPLETE" | "INCOMPLETE_EXPIRED"> = {
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
    trialing: "TRIALING",
    incomplete: "INCOMPLETE",
    incomplete_expired: "INCOMPLETE_EXPIRED",
    paused: "ACTIVE", // Treat paused as active for simplicity
  };

  return statusMap[status] || "INCOMPLETE";
}
