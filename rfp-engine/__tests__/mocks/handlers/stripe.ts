/**
 * Stripe API Mock Handlers
 * Mocks Stripe API responses for testing checkout, webhooks, portal
 */

import { http, HttpResponse } from 'msw';

// Mock customer data store
const mockCustomers = new Map<string, MockCustomer>();
const mockSubscriptions = new Map<string, MockSubscription>();
const mockSessions = new Map<string, MockSession>();

interface MockCustomer {
  id: string;
  email: string;
  name?: string;
  metadata: Record<string, string>;
  created: number;
}

interface MockSubscription {
  id: string;
  customer: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'incomplete';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{
      id: string;
      price: { id: string };
    }>;
  };
  metadata: Record<string, string>;
}

interface MockSession {
  id: string;
  url: string;
  customer: string;
  mode: 'subscription' | 'payment';
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
}

// Helper to generate mock IDs
function generateId(prefix: string): string {
  return `${prefix}_test_${Math.random().toString(36).substring(7)}`;
}

// Helper to create webhook signature
export function createWebhookSignature(payload: string, secret: string): string {
  // In tests, we use a mock signature that the test can verify
  const timestamp = Math.floor(Date.now() / 1000);
  // Real implementation would use HMAC-SHA256
  return `t=${timestamp},v1=mock_signature_${secret.substring(0, 8)}`;
}

// Helper to create mock webhook event payload
export function createWebhookEvent(type: string, data: unknown): string {
  return JSON.stringify({
    id: generateId('evt'),
    type,
    data: { object: data },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  });
}

// Reset mock data between tests
export function resetStripeMocks(): void {
  mockCustomers.clear();
  mockSubscriptions.clear();
  mockSessions.clear();
}

// Add a mock customer
export function addMockCustomer(customer: MockCustomer): void {
  mockCustomers.set(customer.id, customer);
}

// Add a mock subscription
export function addMockSubscription(subscription: MockSubscription): void {
  mockSubscriptions.set(subscription.id, subscription);
}

export const stripeHandlers = [
  // List customers by email
  http.get('https://api.stripe.com/v1/customers', ({ request }) => {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    const customers = Array.from(mockCustomers.values())
      .filter(c => !email || c.email === email);

    return HttpResponse.json({
      data: customers,
      has_more: false,
    });
  }),

  // Create customer
  http.post('https://api.stripe.com/v1/customers', async ({ request }) => {
    const formData = await request.text();
    const params = new URLSearchParams(formData);

    const customer: MockCustomer = {
      id: generateId('cus'),
      email: params.get('email') || '',
      name: params.get('name') || undefined,
      metadata: {},
      created: Math.floor(Date.now() / 1000),
    };

    // Parse metadata
    for (const [key, value] of params.entries()) {
      if (key.startsWith('metadata[')) {
        const metaKey = key.slice(9, -1);
        customer.metadata[metaKey] = value;
      }
    }

    mockCustomers.set(customer.id, customer);
    return HttpResponse.json(customer);
  }),

  // Create checkout session
  http.post('https://api.stripe.com/v1/checkout/sessions', async ({ request }) => {
    const formData = await request.text();
    const params = new URLSearchParams(formData);

    const session: MockSession = {
      id: generateId('cs'),
      url: `https://checkout.stripe.com/pay/${generateId('cs')}`,
      customer: params.get('customer') || '',
      mode: params.get('mode') as 'subscription' | 'payment' || 'subscription',
      success_url: params.get('success_url') || '',
      cancel_url: params.get('cancel_url') || '',
      metadata: {},
    };

    mockSessions.set(session.id, session);
    return HttpResponse.json(session);
  }),

  // Create billing portal session
  http.post('https://api.stripe.com/v1/billing_portal/sessions', async ({ request }) => {
    const formData = await request.text();
    const params = new URLSearchParams(formData);

    return HttpResponse.json({
      id: generateId('bps'),
      url: `https://billing.stripe.com/session/${generateId('bps')}`,
      customer: params.get('customer'),
      return_url: params.get('return_url'),
      created: Math.floor(Date.now() / 1000),
    });
  }),

  // Get subscription
  http.get('https://api.stripe.com/v1/subscriptions/:id', ({ params }) => {
    const subscription = mockSubscriptions.get(params.id as string);

    if (!subscription) {
      return HttpResponse.json(
        { error: { message: 'No such subscription' } },
        { status: 404 }
      );
    }

    return HttpResponse.json(subscription);
  }),

  // Update subscription
  http.post('https://api.stripe.com/v1/subscriptions/:id', async ({ params, request }) => {
    const subscription = mockSubscriptions.get(params.id as string);

    if (!subscription) {
      return HttpResponse.json(
        { error: { message: 'No such subscription' } },
        { status: 404 }
      );
    }

    const formData = await request.text();
    const updateParams = new URLSearchParams(formData);

    if (updateParams.has('cancel_at_period_end')) {
      subscription.cancel_at_period_end = updateParams.get('cancel_at_period_end') === 'true';
    }

    mockSubscriptions.set(subscription.id, subscription);
    return HttpResponse.json(subscription);
  }),

  // Delete subscription (cancel immediately)
  http.delete('https://api.stripe.com/v1/subscriptions/:id', ({ params }) => {
    const subscription = mockSubscriptions.get(params.id as string);

    if (!subscription) {
      return HttpResponse.json(
        { error: { message: 'No such subscription' } },
        { status: 404 }
      );
    }

    subscription.status = 'canceled';
    mockSubscriptions.set(subscription.id, subscription);
    return HttpResponse.json(subscription);
  }),

  // Webhook events construction (handled client-side)
];
