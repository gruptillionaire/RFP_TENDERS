/**
 * Email Verification API Integration Tests
 * Tests POST /api/auth/verify-email
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest } from '../../../setup/test-utils';

// Use vi.hoisted for variables referenced in vi.mock
const mockPrisma = vi.hoisted(() => ({
  emailVerificationToken: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  AuditAction: { USER_EMAIL_VERIFIED: 'user.email.verified' },
  AuditResource: { USER: 'user' },
}));

// Import the route handler after mocking
import { POST } from '@/app/api/auth/verify-email/route';

describe('POST /api/auth/verify-email', () => {
  const validToken = 'a'.repeat(64);
  const testEmail = 'test@example.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful verification', () => {
    it('verifies email with valid token', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'token-123',
        email: testEmail,
        token: validToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
      });
      // Route looks up user by email after finding token
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: testEmail,
        emailVerified: null, // Not yet verified
      });
      mockPrisma.emailVerificationToken.update.mockResolvedValue({
        id: 'token-123',
        usedAt: new Date(),
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-123',
        email: testEmail,
        emailVerified: new Date(),
      });

      const request = createMockRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: { token: validToken },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toContain('verified');
    });

    it('marks token as used to prevent reuse', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'token-123',
        email: testEmail,
        token: validToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
      });
      // Route looks up user by email after finding token
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: testEmail,
        emailVerified: null,
      });
      mockPrisma.emailVerificationToken.update.mockResolvedValue({
        id: 'token-123',
        usedAt: new Date(),
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-123',
        email: testEmail,
        emailVerified: new Date(),
      });

      const request = createMockRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: { token: validToken },
      });

      const response = await POST(request);

      // $transaction is called with array of update operations
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('validation errors', () => {
    it('rejects missing token', async () => {
      const request = createMockRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: {},
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('token');
    });

    it('rejects empty token', async () => {
      const request = createMockRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: { token: '' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('token');
    });
  });

  describe('token validation', () => {
    it('rejects non-existent token', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: { token: validToken },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Invalid');
    });

    it('rejects expired token', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'token-123',
        email: testEmail,
        token: validToken,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
        usedAt: null,
      });

      const request = createMockRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: { token: validToken },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('expired');
    });

    it('rejects already used token', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'token-123',
        email: testEmail,
        token: validToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(Date.now() - 30 * 60 * 1000),
      });

      const request = createMockRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        body: { token: validToken },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('already');
    });
  });
});
