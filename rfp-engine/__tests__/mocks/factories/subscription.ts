/**
 * Subscription and Billing Factories
 * Creates mock Stripe subscription data for testing
 */

// Types matching Stripe API responses
export interface MockStripeSubscription {
  id: string;
  customer: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'paused';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        unit_amount: number;
        currency: string;
        recurring: {
          interval: 'month' | 'year';
          interval_count: number;
        };
      };
    }>;
  };
  metadata: Record<string, string>;
}

export interface MockStripeCustomer {
  id: string;
  email: string;
  name: string | null;
  metadata: Record<string, string>;
  created: number;
  default_source: string | null;
}

export interface MockStripeCheckoutSession {
  id: string;
  url: string;
  customer: string;
  mode: 'subscription' | 'payment';
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  status: 'open' | 'complete' | 'expired';
  success_url: string;
  cancel_url: string;
  subscription: string | null;
  payment_intent: string | null;
  metadata: Record<string, string>;
}

export interface MockStripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'processing' | 'requires_payment_method' | 'requires_confirmation' | 'canceled';
  customer: string;
  metadata: Record<string, string>;
}

// Counters for generating unique IDs
let subscriptionCounter = 0;
let customerCounter = 0;
let sessionCounter = 0;
let paymentCounter = 0;

// Price IDs matching test-env.ts
const PRICE_IDS = {
  STARTER: 'price_test_starter',
  PRO: 'price_test_pro',
  BUSINESS: 'price_test_business',
  SINGLE_USE: 'price_test_single_use',
};

const PRICE_AMOUNTS = {
  STARTER: 15000, // $150
  PRO: 25000, // $250
  BUSINESS: 50000, // $500
  SINGLE_USE: 10000, // $100
};

function generateSubscriptionId(): string {
  subscriptionCounter++;
  return `sub_test_${subscriptionCounter}_${Math.random().toString(36).substring(7)}`;
}

function generateCustomerId(): string {
  customerCounter++;
  return `cus_test_${customerCounter}_${Math.random().toString(36).substring(7)}`;
}

function generateSessionId(): string {
  sessionCounter++;
  return `cs_test_${sessionCounter}_${Math.random().toString(36).substring(7)}`;
}

function generatePaymentId(): string {
  paymentCounter++;
  return `pi_test_${paymentCounter}_${Math.random().toString(36).substring(7)}`;
}

export interface CreateSubscriptionOptions {
  id?: string;
  customerId: string;
  plan?: 'STARTER' | 'PRO' | 'BUSINESS';
  status?: MockStripeSubscription['status'];
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, string>;
}

/**
 * Create a mock Stripe subscription
 */
export function createMockSubscription(options: CreateSubscriptionOptions): MockStripeSubscription {
  const plan = options.plan || 'PRO';
  const now = Math.floor(Date.now() / 1000);
  const periodEnd = now + (30 * 24 * 60 * 60); // 30 days from now

  return {
    id: options.id || generateSubscriptionId(),
    customer: options.customerId,
    status: options.status || 'active',
    current_period_start: now,
    current_period_end: periodEnd,
    cancel_at_period_end: options.cancelAtPeriodEnd ?? false,
    canceled_at: options.status === 'canceled' ? now : null,
    items: {
      data: [
        {
          id: `si_test_${Math.random().toString(36).substring(7)}`,
          price: {
            id: PRICE_IDS[plan],
            unit_amount: PRICE_AMOUNTS[plan],
            currency: 'usd',
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
          },
        },
      ],
    },
    metadata: options.metadata || {},
  };
}

export interface CreateCustomerOptions {
  id?: string;
  email: string;
  name?: string | null;
  userId?: string;
  metadata?: Record<string, string>;
}

/**
 * Create a mock Stripe customer
 */
export function createMockCustomer(options: CreateCustomerOptions): MockStripeCustomer {
  return {
    id: options.id || generateCustomerId(),
    email: options.email,
    name: options.name ?? null,
    metadata: {
      userId: options.userId || '',
      ...options.metadata,
    },
    created: Math.floor(Date.now() / 1000),
    default_source: null,
  };
}

export interface CreateCheckoutSessionOptions {
  id?: string;
  customerId: string;
  plan?: 'STARTER' | 'PRO' | 'BUSINESS' | 'SINGLE_USE';
  mode?: 'subscription' | 'payment';
  status?: MockStripeCheckoutSession['status'];
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * Create a mock Stripe checkout session
 */
export function createMockCheckoutSession(options: CreateCheckoutSessionOptions): MockStripeCheckoutSession {
  const plan = options.plan || 'PRO';
  const mode = options.mode || (plan === 'SINGLE_USE' ? 'payment' : 'subscription');

  return {
    id: options.id || generateSessionId(),
    url: `https://checkout.stripe.com/c/pay/${generateSessionId()}`,
    customer: options.customerId,
    mode,
    payment_status: options.status === 'complete' ? 'paid' : 'unpaid',
    status: options.status || 'open',
    success_url: options.successUrl || 'http://localhost:3000/dashboard?success=true',
    cancel_url: options.cancelUrl || 'http://localhost:3000/pricing?canceled=true',
    subscription: mode === 'subscription' ? generateSubscriptionId() : null,
    payment_intent: mode === 'payment' ? generatePaymentId() : null,
    metadata: plan === 'SINGLE_USE' ? { type: 'single_use' } : {},
  };
}

export interface CreatePaymentIntentOptions {
  id?: string;
  customerId: string;
  amount?: number;
  currency?: string;
  status?: MockStripePaymentIntent['status'];
  metadata?: Record<string, string>;
}

/**
 * Create a mock Stripe payment intent
 */
export function createMockPaymentIntent(options: CreatePaymentIntentOptions): MockStripePaymentIntent {
  return {
    id: options.id || generatePaymentId(),
    amount: options.amount || PRICE_AMOUNTS.SINGLE_USE,
    currency: options.currency || 'usd',
    status: options.status || 'succeeded',
    customer: options.customerId,
    metadata: options.metadata || { type: 'single_use' },
  };
}

/**
 * Create a webhook event payload
 */
export function createWebhookPayload(
  eventType: string,
  data: Record<string, unknown>
): { id: string; type: string; data: { object: Record<string, unknown> }; created: number; livemode: boolean } {
  return {
    id: `evt_test_${Math.random().toString(36).substring(7)}`,
    type: eventType,
    data: { object: data },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  };
}

/**
 * Create subscription created webhook event
 */
export function createSubscriptionCreatedEvent(subscription: MockStripeSubscription) {
  return createWebhookPayload('customer.subscription.created', subscription as unknown as Record<string, unknown>);
}

/**
 * Create subscription updated webhook event
 */
export function createSubscriptionUpdatedEvent(subscription: MockStripeSubscription) {
  return createWebhookPayload('customer.subscription.updated', subscription as unknown as Record<string, unknown>);
}

/**
 * Create subscription deleted webhook event
 */
export function createSubscriptionDeletedEvent(subscription: MockStripeSubscription) {
  return createWebhookPayload('customer.subscription.deleted', subscription as unknown as Record<string, unknown>);
}

/**
 * Create checkout session completed webhook event
 */
export function createCheckoutCompletedEvent(session: MockStripeCheckoutSession) {
  return createWebhookPayload('checkout.session.completed', session as unknown as Record<string, unknown>);
}

/**
 * Create invoice payment succeeded webhook event
 */
export function createInvoicePaidEvent(customerId: string, subscriptionId: string) {
  return createWebhookPayload('invoice.payment_succeeded', {
    id: `in_test_${Math.random().toString(36).substring(7)}`,
    customer: customerId,
    subscription: subscriptionId,
    status: 'paid',
    amount_paid: 25000,
    currency: 'usd',
  });
}

/**
 * Create invoice payment failed webhook event
 */
export function createInvoicePaymentFailedEvent(customerId: string, subscriptionId: string) {
  return createWebhookPayload('invoice.payment_failed', {
    id: `in_test_${Math.random().toString(36).substring(7)}`,
    customer: customerId,
    subscription: subscriptionId,
    status: 'open',
    attempt_count: 1,
  });
}

/**
 * Get price ID for a plan
 */
export function getPriceId(plan: keyof typeof PRICE_IDS): string {
  return PRICE_IDS[plan];
}

/**
 * Reset counters (call in beforeEach if needed)
 */
export function resetSubscriptionFactory(): void {
  subscriptionCounter = 0;
  customerCounter = 0;
  sessionCounter = 0;
  paymentCounter = 0;
}
