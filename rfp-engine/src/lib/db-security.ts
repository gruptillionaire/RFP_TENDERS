/**
 * Database Security Utilities
 *
 * SECURITY CRITICAL:
 * This module provides security utilities for database operations including:
 * - Sensitive field filtering (prevents accidental exposure of secrets)
 * - User ownership validation helpers
 * - Secure query patterns
 *
 * OWASP References:
 * - CWE-200: Exposure of Sensitive Information
 * - CWE-359: Exposure of Private Personal Information
 */

import { prisma } from "./prisma";

/**
 * Fields that should NEVER be returned in API responses or exposed externally
 * These fields contain sensitive authentication/cryptographic data
 */
export const SENSITIVE_USER_FIELDS = [
  "passwordHash",
  "twoFactorSecret",
  "twoFactorBackupCodes",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "singleUseStripePaymentId",
] as const;

/**
 * Fields that require explicit opt-in to include (sensitive but sometimes needed internally)
 */
export const PROTECTED_USER_FIELDS = [
  "email",
  "ipAddress",
  "userAgent",
] as const;

/**
 * Safe user select object that excludes all sensitive fields
 * Use this as the default when fetching user data for API responses
 */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  plan: true,
  subscriptionStatus: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  monthlyExtractionsUsed: true,
  monthlyExtractionsLimit: true,
  monthlyDraftsUsed: true,
  lastUsageReset: true,
  singleUseExtractionsRemaining: true,
  singleUseDraftsRemaining: true,
  singleUsePurchasedAt: true,
  singleUseExpiresAt: true,
  termsAcceptedAt: true,
  privacyPolicyAcceptedAt: true,
  marketingConsentGiven: true,
  cookieConsentGiven: true,
  doNotSellData: true,
  deletedAt: true,
  twoFactorEnabled: true,
  twoFactorVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  // EXCLUDED: passwordHash, twoFactorSecret, twoFactorBackupCodes, stripeCustomerId, stripeSubscriptionId, singleUseStripePaymentId
} as const;

/**
 * Minimal user select for public-facing contexts (e.g., version history editor info)
 */
export const MINIMAL_USER_SELECT = {
  id: true,
  name: true,
  // email intentionally excluded for privacy
} as const;

/**
 * Type-safe user ownership verification
 * Returns true if the user owns the resource, false otherwise
 *
 * @param resourceUserId - The userId field on the resource
 * @param sessionUserId - The authenticated user's ID from the session
 */
export function verifyOwnership(
  resourceUserId: string | null | undefined,
  sessionUserId: string
): boolean {
  if (!resourceUserId || !sessionUserId) {
    return false;
  }
  return resourceUserId === sessionUserId;
}

/**
 * Verify user owns a project
 * Performs a database lookup and returns the project if owned, null otherwise
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<{ id: string; userId: string } | null> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: userId,
    },
    select: {
      id: true,
      userId: true,
    },
  });
  return project;
}

/**
 * Verify user owns a requirement through its project
 * Performs a database lookup and returns the requirement if owned, null otherwise
 */
export async function verifyRequirementOwnership(
  requirementId: string,
  userId: string
): Promise<{
  id: string;
  projectId: string;
  project: { userId: string };
} | null> {
  const requirement = await prisma.requirement.findFirst({
    where: {
      id: requirementId,
      project: {
        userId: userId,
      },
    },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          userId: true,
        },
      },
    },
  });
  return requirement;
}

/**
 * Verify user owns a past response (library item)
 */
export async function verifyPastResponseOwnership(
  responseId: string,
  userId: string
): Promise<{ id: string; userId: string } | null> {
  const response = await prisma.pastResponse.findFirst({
    where: {
      id: responseId,
      userId: userId,
    },
    select: {
      id: true,
      userId: true,
    },
  });
  return response;
}

/**
 * Strip sensitive fields from a user object
 * Use this when you have a full user object and need to sanitize it before returning
 */
export function stripSensitiveUserFields<T extends Record<string, unknown>>(
  user: T
): Omit<T, (typeof SENSITIVE_USER_FIELDS)[number]> {
  const sanitized = { ...user };
  for (const field of SENSITIVE_USER_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

/**
 * Validate that a string ID is a valid CUID format
 * Prevents injection of malformed IDs
 */
export function isValidCuid(id: string): boolean {
  // CUID format: starts with 'c', followed by 24 lowercase alphanumeric characters
  const cuidRegex = /^c[a-z0-9]{24}$/;
  return typeof id === "string" && cuidRegex.test(id);
}

/**
 * Sanitize a database ID input
 * Returns the ID if valid, throws an error if invalid
 */
export function sanitizeId(id: unknown, fieldName = "id"): string {
  if (typeof id !== "string") {
    throw new Error(`Invalid ${fieldName}: must be a string`);
  }
  if (!isValidCuid(id)) {
    throw new Error(`Invalid ${fieldName}: malformed ID format`);
  }
  return id;
}

/**
 * Secure pagination parameters
 * Ensures pagination values are within safe bounds to prevent DoS
 */
export function securePagination(
  limit?: number | string | null,
  offset?: number | string | null,
  maxLimit = 100,
  defaultLimit = 20
): { limit: number; offset: number } {
  let parsedLimit =
    typeof limit === "string" ? parseInt(limit, 10) : limit ?? defaultLimit;
  let parsedOffset =
    typeof offset === "string" ? parseInt(offset, 10) : offset ?? 0;

  // Ensure values are valid numbers
  if (isNaN(parsedLimit) || parsedLimit < 1) {
    parsedLimit = defaultLimit;
  }
  if (isNaN(parsedOffset) || parsedOffset < 0) {
    parsedOffset = 0;
  }

  // Enforce maximum limit to prevent DoS
  parsedLimit = Math.min(parsedLimit, maxLimit);

  // Enforce maximum offset to prevent deep pagination attacks
  const maxOffset = 10000; // Reasonable limit for most use cases
  parsedOffset = Math.min(parsedOffset, maxOffset);

  return {
    limit: parsedLimit,
    offset: parsedOffset,
  };
}
