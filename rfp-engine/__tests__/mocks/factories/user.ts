/**
 * User Factory
 * Creates mock user data for testing
 */

import bcrypt from 'bcryptjs';

// Types matching Prisma schema
export interface MockUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  passwordHash: string | null;
  plan: 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'TRIALING' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  monthlyExtractionsUsed: number;
  monthlyExtractionsLimit: number;
  monthlyDraftsUsed: number;
  lastUsageReset: Date;
  singleUseExtractionsRemaining: number;
  singleUseDraftsRemaining: number;
  singleUsePurchasedAt: Date | null;
  singleUseExpiresAt: Date | null;
  termsAcceptedAt: Date | null;
  privacyPolicyAcceptedAt: Date | null;
  marketingConsentGiven: boolean;
  cookieConsentGiven: boolean;
  doNotSellData: boolean;
  deletedAt: Date | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorBackupCodes: string[];
  twoFactorVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Counter for generating unique IDs/emails
let userCounter = 0;

// Generate unique user ID
function generateUserId(): string {
  userCounter++;
  return `user_test_${userCounter}_${Math.random().toString(36).substring(7)}`;
}

// Generate unique email
function generateEmail(suffix?: string): string {
  userCounter++;
  const base = suffix ? `test-${suffix}` : `test-user-${userCounter}`;
  return `${base}@example.com`;
}

// Default password for test users
const DEFAULT_PASSWORD = 'TestPassword123!';
let defaultPasswordHash: string | null = null;

// Get or generate the default password hash (cached for performance)
async function getDefaultPasswordHash(): Promise<string> {
  if (!defaultPasswordHash) {
    defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  }
  return defaultPasswordHash;
}

// Synchronous version using pre-computed hash
const PRECOMPUTED_HASH = '$2a$10$test.hash.for.testing.purposes.only.abcdefghij';

export interface CreateUserOptions {
  id?: string;
  name?: string | null;
  email?: string;
  password?: string;
  emailVerified?: boolean;
  plan?: MockUser['plan'];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: MockUser['subscriptionStatus'];
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  deletedAt?: Date | null;
  monthlyExtractionsUsed?: number;
  monthlyExtractionsLimit?: number;
  monthlyDraftsUsed?: number;
  singleUseExtractionsRemaining?: number;
  singleUseDraftsRemaining?: number;
}

/**
 * Create a mock user object
 * Use this for unit tests that don't need database
 */
export function createMockUser(options: CreateUserOptions = {}): MockUser {
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return {
    id: options.id || generateUserId(),
    name: options.name ?? 'Test User',
    email: options.email || generateEmail(),
    emailVerified: options.emailVerified ? now : null,
    passwordHash: options.password === null ? null : PRECOMPUTED_HASH,
    plan: options.plan || 'FREE',
    stripeCustomerId: options.stripeCustomerId || null,
    stripeSubscriptionId: options.stripeSubscriptionId || null,
    subscriptionStatus: options.subscriptionStatus || null,
    currentPeriodEnd: options.subscriptionStatus === 'ACTIVE' ? nextMonth : null,
    cancelAtPeriodEnd: false,
    monthlyExtractionsUsed: options.monthlyExtractionsUsed ?? 0,
    monthlyExtractionsLimit: options.monthlyExtractionsLimit ?? (options.plan === 'PRO' ? 10 : options.plan === 'STARTER' ? 2 : 0),
    monthlyDraftsUsed: options.monthlyDraftsUsed ?? 0,
    lastUsageReset: now,
    singleUseExtractionsRemaining: options.singleUseExtractionsRemaining ?? 0,
    singleUseDraftsRemaining: options.singleUseDraftsRemaining ?? 0,
    singleUsePurchasedAt: null,
    singleUseExpiresAt: null,
    termsAcceptedAt: options.termsAccepted ? now : null,
    privacyPolicyAcceptedAt: options.privacyAccepted ? now : null,
    marketingConsentGiven: false,
    cookieConsentGiven: false,
    doNotSellData: false,
    deletedAt: options.deletedAt ?? null,
    twoFactorEnabled: options.twoFactorEnabled ?? false,
    twoFactorSecret: options.twoFactorSecret || null,
    twoFactorBackupCodes: [],
    twoFactorVerifiedAt: options.twoFactorEnabled ? now : null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create user data for database insertion
 * Use this for integration tests with real database
 */
export async function createUserData(options: CreateUserOptions = {}): Promise<Omit<MockUser, 'createdAt' | 'updatedAt'>> {
  const mockUser = createMockUser(options);

  // Use real password hash for database tests
  if (options.password !== null) {
    mockUser.passwordHash = await bcrypt.hash(options.password || DEFAULT_PASSWORD, 10);
  }

  const { createdAt: _, updatedAt: __, ...data } = mockUser;
  return data;
}

/**
 * Create a verified user with subscription
 */
export function createSubscribedUser(plan: MockUser['plan'] = 'PRO'): MockUser {
  const limits = {
    FREE: { extractions: 0, drafts: 0 },
    STARTER: { extractions: 2, drafts: 200 },
    PRO: { extractions: 10, drafts: 600 },
    BUSINESS: { extractions: -1, drafts: 600 },
    ENTERPRISE: { extractions: -1, drafts: -1 },
  };

  return createMockUser({
    plan,
    emailVerified: true,
    termsAccepted: true,
    privacyAccepted: true,
    stripeCustomerId: `cus_test_${Math.random().toString(36).substring(7)}`,
    stripeSubscriptionId: `sub_test_${Math.random().toString(36).substring(7)}`,
    subscriptionStatus: 'ACTIVE',
    monthlyExtractionsLimit: limits[plan].extractions,
  });
}

/**
 * Create a user with 2FA enabled
 */
export function createTwoFactorUser(): MockUser {
  return createMockUser({
    emailVerified: true,
    termsAccepted: true,
    privacyAccepted: true,
    twoFactorEnabled: true,
    twoFactorSecret: 'JBSWY3DPEHPK3PXP', // Example TOTP secret
  });
}

/**
 * Get the default test password
 */
export function getDefaultPassword(): string {
  return DEFAULT_PASSWORD;
}

/**
 * Reset the user counter (call in beforeEach if needed)
 */
export function resetUserFactory(): void {
  userCounter = 0;
}
