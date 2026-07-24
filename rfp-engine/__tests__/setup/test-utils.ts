/**
 * Test Utilities
 * Helper functions for testing Next.js API routes
 */

import { vi } from 'vitest';

/**
 * Create a mock Request object for API route testing
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Request {
  const { method = 'GET', body, headers = {} } = options;

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    requestInit.body = JSON.stringify(body);
  }

  return new Request(url, requestInit);
}

/**
 * Create a mock NextRequest for API route testing
 */
export function createMockNextRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  } = {}
): Request & { nextUrl: URL } {
  const request = createMockRequest(url, options);

  // Add nextUrl property for Next.js compatibility
  Object.defineProperty(request, 'nextUrl', {
    value: new URL(url),
    writable: false,
  });

  return request as Request & { nextUrl: URL };
}

/**
 * Parse JSON response from API route
 */
export async function parseJsonResponse<T = unknown>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/**
 * Assert response status and return body
 */
export async function assertJsonResponse<T = unknown>(
  response: Response,
  expectedStatus: number
): Promise<T> {
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. Body: ${body}`
    );
  }
  return parseJsonResponse<T>(response);
}

/**
 * Mock Prisma client for testing
 * Returns a mock that tracks calls and allows configuring responses
 */
export function createMockPrisma() {
  const mockUser = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };

  const mockProject = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };

  const mockRequirement = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };

  const mockEmailVerificationToken = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };

  const mockPasswordResetToken = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };

  const mockSubscription = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockProcessedWebhookEvent = {
    findUnique: vi.fn(),
    create: vi.fn(),
  };

  const mockConsentLog = {
    create: vi.fn(),
    findMany: vi.fn(),
  };

  const mockAuditLog = {
    create: vi.fn(),
    findMany: vi.fn(),
  };

  const mockPastResponse = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };

  const mockPending2FASession = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };

  return {
    user: mockUser,
    project: mockProject,
    requirement: mockRequirement,
    emailVerificationToken: mockEmailVerificationToken,
    passwordResetToken: mockPasswordResetToken,
    subscription: mockSubscription,
    processedWebhookEvent: mockProcessedWebhookEvent,
    consentLog: mockConsentLog,
    auditLog: mockAuditLog,
    pastResponse: mockPastResponse,
    pending2FASession: mockPending2FASession,
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $queryRaw: vi.fn(),
  };
}

/**
 * Create a mock session for authenticated requests
 */
export function createMockSession(userId: string, email: string = 'test@example.com') {
  return {
    user: {
      id: userId,
      email,
      name: 'Test User',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random email for testing
 */
export function randomEmail(): string {
  return `test-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Generate a valid password for testing
 */
export function validPassword(): string {
  return 'TestPassword123!';
}

/**
 * Generate an invalid password (missing requirements)
 */
export function invalidPassword(): string {
  return 'weak';
}
