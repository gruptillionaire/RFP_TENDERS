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
  if (!process.env.STRIPE_STARTER_PRICE_ID) console.warn("Warning: STRIPE_STARTER_PRICE_ID not set - checkout will fail for Starter plan");
  if (!process.env.STRIPE_PRO_PRICE_ID) console.warn("Warning: STRIPE_PRO_PRICE_ID not set - checkout will fail for Pro plan");
  if (!process.env.STRIPE_BUSINESS_PRICE_ID) console.warn("Warning: STRIPE_BUSINESS_PRICE_ID not set - checkout will fail for Business plan");
  if (!process.env.STRIPE_SINGLE_USE_PRICE_ID) console.warn("Warning: STRIPE_SINGLE_USE_PRICE_ID not set - checkout will fail for Single RFP purchase");
}

export const PLAN_CONFIG = {
  STARTER: {
    name: "Starter",
    priceId: process.env.STRIPE_STARTER_PRICE_ID || "",
    monthlyPrice: 150,
    currency: "usd",
    features: [
      "2 RFPs per month",
      "200 AI draft responses per month",
      "150 page limit per upload",
      "AI-powered requirement detection",
      "Export to Word & PDF",
    ],
    limitations: [
      "No response library",
    ],
    limits: {
      monthlyExtractions: 2,
      activeProjects: 2,
      monthlyDrafts: 200,
      maxPagesPerUpload: 150,
      storedResponses: 0, // No library access
      canExportWord: true,
      canUseLibrary: false,
    },
  },
  PRO: {
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    monthlyPrice: 250,
    currency: "usd",
    features: [
      "10 RFPs per month",
      "600 AI draft responses per month",
      "200 page limit per upload",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word & PDF",
    ],
    limitations: [],
    limits: {
      monthlyExtractions: 10,
      activeProjects: 10,
      monthlyDrafts: 600,
      maxPagesPerUpload: 200,
      storedResponses: 500,
      canExportWord: true,
      canUseLibrary: true,
    },
  },
  BUSINESS: {
    name: "Business",
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID || "",
    monthlyPrice: 500,
    currency: "usd",
    features: [
      "Unlimited RFPs",
      "600 AI draft responses per month",
      "No page limit",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word & PDF",
      "Priority support",
    ],
    limitations: [],
    limits: {
      monthlyExtractions: -1, // -1 = unlimited
      activeProjects: -1,
      monthlyDrafts: 600,
      maxPagesPerUpload: -1, // No limit
      storedResponses: -1,
      canExportWord: true,
      canUseLibrary: true,
    },
  },
  ENTERPRISE: {
    name: "Enterprise",
    priceId: "", // Custom pricing - no Stripe price ID
    monthlyPrice: 0, // Custom pricing
    currency: "usd",
    features: [
      "Unlimited RFPs",
      "Unlimited AI draft responses",
      "No page limit",
      "AI-powered requirement detection",
      "Response library",
      "Export to Word & PDF",
      "Priority support",
      "Dedicated account manager",
    ],
    limitations: [],
    limits: {
      monthlyExtractions: -1,
      activeProjects: -1,
      monthlyDrafts: -1,
      maxPagesPerUpload: -1,
      storedResponses: -1,
      canExportWord: true,
      canUseLibrary: true,
    },
  },
} as const;

export type PlanType = keyof typeof PLAN_CONFIG;

// Single-use (one-time payment) product configuration
export const SINGLE_USE_CONFIG = {
  priceId: process.env.STRIPE_SINGLE_USE_PRICE_ID || "",
  price: 100,
  currency: "usd",
  name: "Single RFP",
  description: "One-time purchase for a single RFP project",
  features: [
    "1 RFP extraction",
    "100 AI draft responses",
    "150 page limit per upload",
    "Export to Word & PDF",
    "30-day project access",
  ],
  limitations: [
    "No response library",
    "Project expires after 30 days",
  ],
  limits: {
    extractions: 1,
    drafts: 100,
    maxPagesPerUpload: 150,
    expirationDays: 30,
    canExportWord: true,
    canUseLibrary: false,
  },
} as const;

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
      monthlyExtractions: 0,
      activeProjects: 0,
      monthlyDrafts: 0,
      maxPagesPerUpload: 0,
      storedResponses: 0,
      canExportWord: false,
      canUseLibrary: false,
    };
  }
  return PLAN_CONFIG[plan as PlanType]?.limits || PLAN_CONFIG.STARTER.limits;
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
    // Save billing address to customer for tax calculation
    customer_update: {
      address: "auto",
    },
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

// Create checkout session for one-time single-use purchase
export async function createSingleUseCheckoutSession(
  customerId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();

  if (!SINGLE_USE_CONFIG.priceId) {
    throw new Error("STRIPE_SINGLE_USE_PRICE_ID is not configured");
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment", // One-time payment, NOT subscription
    payment_method_types: ["card"],
    line_items: [
      {
        price: SINGLE_USE_CONFIG.priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    customer_update: {
      address: "auto",
    },
    automatic_tax: { enabled: true },
    payment_intent_data: {
      metadata: {
        type: "single_use",
        customerId,
      },
    },
    metadata: {
      type: "single_use", // Used in webhook to identify payment type
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
