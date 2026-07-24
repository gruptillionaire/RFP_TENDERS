/**
 * Signup API Integration Tests
 * Tests POST /api/auth/signup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, randomEmail, validPassword } from '../../../setup/test-utils';

// Use vi.hoisted for variables referenced in vi.mock
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  emailVerificationToken: {
    create: vi.fn(),
  },
  consentLog: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    signup: vi.fn().mockResolvedValue({ success: true, remaining: 10 }),
  },
}));

vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/audit', () => ({
  logConsent: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
  AuditAction: { USER_SIGNUP: 'user.signup' },
  AuditResource: { USER: 'user' },
}));

// Import the route handler after mocking
import { POST } from '@/app/api/auth/signup/route';

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockImplementation(async ({ data }) => ({
      id: 'user-123',
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    mockPrisma.emailVerificationToken.create.mockResolvedValue({
      id: 'token-123',
      email: 'test@example.com',
      token: 'verification-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  });

  describe('successful signup', () => {
    it('creates user with valid data', async () => {
      const email = randomEmail();
      const request = createMockRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: {
          email,
          password: validPassword(),
          name: 'Test User',
          acceptTerms: true,
          acceptPrivacy: true,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.email).toBe(email.toLowerCase());
      expect(body.name).toBe('Test User');
      expect(body.emailVerificationSent).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('normalizes email to lowercase', async () => {
      const email = 'TEST@EXAMPLE.COM';
      const request = createMockRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: {
          email,
          password: validPassword(),
          acceptTerms: true,
          acceptPrivacy: true,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.email).toBe('test@example.com');
    });
  });

  describe('validation errors', () => {
    it('rejects weak password - too short', async () => {
      const request = createMockRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: {
          email: randomEmail(),
          password: 'Short1!',
          acceptTerms: true,
          acceptPrivacy: true,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('8 characters');
    });

    it('rejects password without uppercase', async () => {
      const request = createMockRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: {
          email: randomEmail(),
          password: 'lowercase123!',
          acceptTerms: true,
          acceptPrivacy: true,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('uppercase');
    });
  });

  describe('consent requirements', () => {
    it('rejects signup without terms acceptance', async () => {
      const request = createMockRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: {
          email: randomEmail(),
          password: validPassword(),
          acceptTerms: false,
          acceptPrivacy: true,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Terms of Service');
    });
  });

  describe('duplicate email handling', () => {
    it('rejects signup with existing email', async () => {
      const email = randomEmail();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email,
      });

      const request = createMockRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: {
          email,
          password: validPassword(),
          acceptTerms: true,
          acceptPrivacy: true,
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('already exists');
    });
  });
});
