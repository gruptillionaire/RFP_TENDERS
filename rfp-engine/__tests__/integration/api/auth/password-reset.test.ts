/**
 * Password Reset API Integration Tests
 * Tests POST /api/auth/forgot-password and POST /api/auth/reset-password
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, randomEmail } from '../../../setup/test-utils';

// Use vi.hoisted for variables referenced in vi.mock
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  passwordResetToken: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

const mockSendPasswordResetEmail = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  AuditActions: { PASSWORD_RESET_REQUESTED: 'password.reset.requested' },
}));

// Import the route handler after mocking
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';

describe('Password Reset Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/forgot-password', () => {
    describe('successful request', () => {
      it('returns success message for existing user', async () => {
        const email = randomEmail();
        mockPrisma.user.findUnique.mockResolvedValue({
          id: 'user-123',
          email,
          passwordHash: 'hashed-password',
        });
        mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.passwordResetToken.create.mockResolvedValue({
          id: 'token-123',
          email,
          token: 'reset-token',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        const request = createMockRequest('http://localhost:3000/api/auth/forgot-password', {
          method: 'POST',
          body: { email },
        });

        const response = await forgotPassword(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.message).toContain('If an account exists');
        expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(email.toLowerCase(), expect.any(String));
      });

      it('returns same success message for non-existing user (prevents enumeration)', async () => {
        const email = randomEmail();
        mockPrisma.user.findUnique.mockResolvedValue(null);

        const request = createMockRequest('http://localhost:3000/api/auth/forgot-password', {
          method: 'POST',
          body: { email },
        });

        const response = await forgotPassword(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.message).toContain('If an account exists');
        expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it('normalizes email to lowercase', async () => {
        const email = 'TEST@EXAMPLE.COM';
        mockPrisma.user.findUnique.mockResolvedValue({
          id: 'user-123',
          email: email.toLowerCase(),
          passwordHash: 'hashed-password',
        });
        mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.passwordResetToken.create.mockResolvedValue({
          id: 'token-123',
          email: email.toLowerCase(),
          token: 'reset-token',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        const request = createMockRequest('http://localhost:3000/api/auth/forgot-password', {
          method: 'POST',
          body: { email },
        });

        await forgotPassword(request);

        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { email: 'test@example.com' },
          })
        );
      });
    });

    describe('validation errors', () => {
      it('rejects missing email', async () => {
        const request = createMockRequest('http://localhost:3000/api/auth/forgot-password', {
          method: 'POST',
          body: {},
        });

        const response = await forgotPassword(request);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain('email');
      });

      it('rejects invalid email format', async () => {
        const request = createMockRequest('http://localhost:3000/api/auth/forgot-password', {
          method: 'POST',
          body: { email: 'not-an-email' },
        });

        const response = await forgotPassword(request);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain('email');
      });
    });

    describe('OAuth-only accounts', () => {
      it('does not send email for OAuth-only users (no password)', async () => {
        const email = randomEmail();
        mockPrisma.user.findUnique.mockResolvedValue({
          id: 'user-123',
          email,
          passwordHash: null,
        });

        const request = createMockRequest('http://localhost:3000/api/auth/forgot-password', {
          method: 'POST',
          body: { email },
        });

        const response = await forgotPassword(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.message).toContain('If an account exists');
        expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
      });
    });
  });
});
