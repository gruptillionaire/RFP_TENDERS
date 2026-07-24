/**
 * Stripe Webhook Integration Tests
 * Tests POST /api/billing/webhook for all event types
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest } from '../../../setup/test-utils';
import {
  createMockSubscription,
  createSubscriptionUpdatedEvent,
  createSubscriptionDeletedEvent,
  createCheckoutCompletedEvent,
  createMockCheckoutSession,
} from '../../../mocks/factories';

// Use vi.hoisted for variables referenced in vi.mock
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  processedWebhookEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  singleUsePurchase: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((fns: Array<Promise<unknown>>) => Promise.all(fns)),
}));

const mockConstructWebhookEvent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/stripe', async () => {
  const actual = await vi.importActual('@/lib/stripe');
  return {
    ...actual,
    constructWebhookEvent: mockConstructWebhookEvent,
  };
});

vi.mock('@/lib/email', () => ({
  sendSubscriptionStartedEmail: vi.fn().mockResolvedValue({ success: true }),
  sendSubscriptionCancelledEmail: vi.fn().mockResolvedValue({ success: true }),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  AuditAction: {
    BILLING_CHECKOUT_COMPLETED: 'billing.checkout.completed',
    BILLING_SUBSCRIPTION_UPDATED: 'billing.subscription.updated',
    BILLING_SUBSCRIPTION_CANCELLED: 'billing.subscription.cancelled',
    BILLING_PAYMENT_SUCCEEDED: 'billing.payment.succeeded',
    BILLING_PAYMENT_FAILED: 'billing.payment.failed',
  },
  AuditResource: {
    SUBSCRIPTION: 'subscription',
    INVOICE: 'invoice',
  },
}));

// Import the route handler after mocking
import { POST } from '@/app/api/billing/webhook/route';

describe('POST /api/billing/webhook', () => {
  const testUserId = 'user-123';
  const testEmail = 'test@example.com';
  const testCustomerId = 'cus_test_123';
  const validSignature = 't=1234567890,v1=valid_signature';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.processedWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.processedWebhookEvent.create.mockResolvedValue({ id: 'event-123' });
    mockPrisma.processedWebhookEvent.deleteMany.mockResolvedValue({ count: 0 });
  });

  describe('signature verification', () => {
    it('rejects request without signature header', async () => {
      const request = createMockRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        body: {},
        headers: {},
      });

      const response = await POST(request as unknown as import('next/server').NextRequest);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('signature');
    });

    it('rejects request with invalid signature', async () => {
      mockConstructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const request = createMockRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        body: {},
        headers: { 'stripe-signature': 'invalid_signature' },
      });

      const response = await POST(request as unknown as import('next/server').NextRequest);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('signature');
    });
  });

  describe('idempotency', () => {
    it('skips already processed events', async () => {
      const subscription = createMockSubscription({ customerId: testCustomerId, plan: 'PRO' });
      const event = createSubscriptionUpdatedEvent(subscription);

      mockConstructWebhookEvent.mockReturnValue(event);
      mockPrisma.processedWebhookEvent.findUnique.mockResolvedValue({ id: event.id });

      const request = createMockRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        body: event,
        headers: { 'stripe-signature': validSignature },
      });

      const response = await POST(request as unknown as import('next/server').NextRequest);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.received).toBe(true);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('marks events as processed', async () => {
      const subscription = createMockSubscription({ customerId: testCustomerId, plan: 'PRO' });
      const event = createSubscriptionUpdatedEvent(subscription);

      mockConstructWebhookEvent.mockReturnValue(event);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: testUserId,
        email: testEmail,
        plan: 'FREE',
        stripeCustomerId: testCustomerId,
      });
      mockPrisma.user.update.mockResolvedValue({ id: testUserId });

      const request = createMockRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        body: event,
        headers: { 'stripe-signature': validSignature },
      });

      await POST(request as unknown as import('next/server').NextRequest);

      expect(mockPrisma.processedWebhookEvent.create).toHaveBeenCalledWith({
        data: { id: event.id },
      });
    });
  });

  describe('checkout.session.completed', () => {
    it('updates user with subscription ID', async () => {
      const session = createMockCheckoutSession({
        customerId: testCustomerId,
        plan: 'PRO',
        status: 'complete',
      });
      const event = createCheckoutCompletedEvent(session);

      mockConstructWebhookEvent.mockReturnValue(event);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: testUserId,
        email: testEmail,
        plan: 'FREE',
        stripeCustomerId: testCustomerId,
      });
      mockPrisma.user.update.mockResolvedValue({ id: testUserId });

      const request = createMockRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        body: event,
        headers: { 'stripe-signature': validSignature },
      });

      const response = await POST(request as unknown as import('next/server').NextRequest);

      expect(response.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testUserId },
          data: expect.objectContaining({
            stripeSubscriptionId: session.subscription,
          }),
        })
      );
    });
  });

  describe('customer.subscription.deleted', () => {
    it('reverts user to FREE plan', async () => {
      const subscription = createMockSubscription({
        customerId: testCustomerId,
        plan: 'PRO',
        status: 'canceled',
      });
      const event = createSubscriptionDeletedEvent(subscription);

      mockConstructWebhookEvent.mockReturnValue(event);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: testUserId,
        email: testEmail,
        plan: 'PRO',
        stripeCustomerId: testCustomerId,
        currentPeriodEnd: new Date(),
      });
      mockPrisma.user.update.mockResolvedValue({ id: testUserId, plan: 'FREE' });

      const request = createMockRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        body: event,
        headers: { 'stripe-signature': validSignature },
      });

      const response = await POST(request as unknown as import('next/server').NextRequest);

      expect(response.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            plan: 'FREE',
            subscriptionStatus: 'CANCELED',
            stripeSubscriptionId: null,
            monthlyExtractionsLimit: 0,
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('handles missing user gracefully', async () => {
      const subscription = createMockSubscription({ customerId: 'unknown_customer', plan: 'PRO' });
      const event = createSubscriptionUpdatedEvent(subscription);

      mockConstructWebhookEvent.mockReturnValue(event);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        body: event,
        headers: { 'stripe-signature': validSignature },
      });

      const response = await POST(request as unknown as import('next/server').NextRequest);

      expect(response.status).toBe(200);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('unhandled event types', () => {
    it('returns success for unhandled event types', async () => {
      const event = {
        id: 'evt_test_unhandled',
        type: 'customer.created',
        data: { object: {} },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
      };

      mockConstructWebhookEvent.mockReturnValue(event);

      const request = createMockRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        body: event,
        headers: { 'stripe-signature': validSignature },
      });

      const response = await POST(request as unknown as import('next/server').NextRequest);

      expect(response.status).toBe(200);
    });
  });
});
