import { prisma } from "./prisma";
import { QUOTA_LIMITS, DRAFT_LIMITS } from "./constants";

interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Check if user can perform extraction and optionally increment usage
 * Uses a transaction to prevent race conditions
 */
export async function checkAndIncrementQuota(
  userId: string,
  increment: boolean = false
): Promise<QuotaCheckResult> {
  // Use transaction for atomic read-check-update
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        monthlyExtractionsUsed: true,
        monthlyExtractionsLimit: true,
        lastUsageReset: true,
      },
    });

    if (!user) {
      return { allowed: false, used: 0, limit: 0, remaining: 0 };
    }

    // Check if we need to reset monthly usage
    const now = new Date();
    const lastReset = new Date(user.lastUsageReset);
    const shouldReset = isNewBillingPeriod(lastReset, now);

    let currentUsage = shouldReset ? 0 : user.monthlyExtractionsUsed;

    // Get limit based on plan
    const limit =
      user.plan === "BUSINESS"
        ? QUOTA_LIMITS.BUSINESS
        : user.plan === "TEAM"
        ? QUOTA_LIMITS.TEAM
        : user.plan === "PRO"
        ? QUOTA_LIMITS.PRO
        : user.plan === "STARTER"
        ? QUOTA_LIMITS.STARTER
        : user.monthlyExtractionsLimit || QUOTA_LIMITS.FREE;

    // Unlimited plans have -1 as limit
    const isUnlimited = limit === -1;
    const allowed = isUnlimited || currentUsage < limit;

    // Perform update within transaction if needed
    if (increment && allowed) {
      await tx.user.update({
        where: { id: userId },
        data: {
          monthlyExtractionsUsed: shouldReset ? 1 : { increment: 1 },
          ...(shouldReset && { lastUsageReset: now }),
        },
      });
      currentUsage = shouldReset ? 1 : currentUsage + 1;
    } else if (shouldReset) {
      // Just reset without increment
      await tx.user.update({
        where: { id: userId },
        data: {
          monthlyExtractionsUsed: 0,
          lastUsageReset: now,
        },
      });
    }

    const remaining = isUnlimited ? -1 : Math.max(0, limit - currentUsage);

    return {
      allowed,
      used: currentUsage,
      limit: isUnlimited ? -1 : limit,
      remaining,
    };
  });
}

/**
 * Check if a new billing period has started (monthly reset)
 */
function isNewBillingPeriod(lastReset: Date, now: Date): boolean {
  return (
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  );
}

/**
 * Get current quota status without incrementing
 */
export async function getQuotaStatus(userId: string): Promise<QuotaCheckResult> {
  return checkAndIncrementQuota(userId, false);
}

/**
 * Check if user can generate a draft and optionally increment usage
 */
export async function checkAndIncrementDraftQuota(
  userId: string,
  increment: boolean = false
): Promise<QuotaCheckResult> {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        monthlyDraftsUsed: true,
        lastUsageReset: true,
      },
    });

    if (!user) {
      return { allowed: false, used: 0, limit: 0, remaining: 0 };
    }

    // Check if we need to reset monthly usage
    const now = new Date();
    const lastReset = new Date(user.lastUsageReset);
    const shouldReset = isNewBillingPeriod(lastReset, now);

    let currentUsage = shouldReset ? 0 : user.monthlyDraftsUsed;

    // Get limit based on plan
    const limit =
      user.plan === "BUSINESS"
        ? DRAFT_LIMITS.BUSINESS
        : user.plan === "TEAM"
        ? DRAFT_LIMITS.TEAM
        : user.plan === "PRO"
        ? DRAFT_LIMITS.PRO
        : user.plan === "STARTER"
        ? DRAFT_LIMITS.STARTER
        : DRAFT_LIMITS.FREE;

    const isUnlimited = limit === -1;
    const allowed = isUnlimited || currentUsage < limit;

    if (increment && allowed) {
      await tx.user.update({
        where: { id: userId },
        data: {
          monthlyDraftsUsed: shouldReset ? 1 : { increment: 1 },
          ...(shouldReset && { lastUsageReset: now, monthlyExtractionsUsed: 0 }),
        },
      });
      currentUsage = shouldReset ? 1 : currentUsage + 1;
    } else if (shouldReset) {
      await tx.user.update({
        where: { id: userId },
        data: {
          monthlyDraftsUsed: 0,
          monthlyExtractionsUsed: 0,
          lastUsageReset: now,
        },
      });
    }

    const remaining = isUnlimited ? -1 : Math.max(0, limit - currentUsage);

    return {
      allowed,
      used: currentUsage,
      limit: isUnlimited ? -1 : limit,
      remaining,
    };
  });
}

/**
 * Get current draft quota status without incrementing
 */
export async function getDraftQuotaStatus(userId: string): Promise<QuotaCheckResult> {
  return checkAndIncrementDraftQuota(userId, false);
}

// =============================================================================
// SINGLE-USE QUOTA FUNCTIONS
// =============================================================================

interface SingleUseQuotaResult {
  hasCredits: boolean;
  extractionsRemaining: number;
  draftsRemaining: number;
  expiresAt: Date | null;
  isExpired: boolean;
}

/**
 * Get single-use quota status for a user
 */
export async function getSingleUseQuotaStatus(userId: string): Promise<SingleUseQuotaResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      singleUseExtractionsRemaining: true,
      singleUseDraftsRemaining: true,
      singleUseExpiresAt: true,
    },
  });

  if (!user) {
    return {
      hasCredits: false,
      extractionsRemaining: 0,
      draftsRemaining: 0,
      expiresAt: null,
      isExpired: false,
    };
  }

  const isExpired = user.singleUseExpiresAt
    ? new Date() > user.singleUseExpiresAt
    : false;

  return {
    hasCredits: user.singleUseExtractionsRemaining > 0 && !isExpired,
    extractionsRemaining: isExpired ? 0 : user.singleUseExtractionsRemaining,
    draftsRemaining: isExpired ? 0 : user.singleUseDraftsRemaining,
    expiresAt: user.singleUseExpiresAt,
    isExpired,
  };
}

/**
 * Check and consume a single-use extraction credit
 * Returns whether the operation was allowed and remaining credits
 */
export async function checkAndConsumeSingleUseExtraction(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        singleUseExtractionsRemaining: true,
        singleUseExpiresAt: true,
      },
    });

    if (!user) {
      return { allowed: false, remaining: 0 };
    }

    // Check expiration
    if (user.singleUseExpiresAt && new Date() > user.singleUseExpiresAt) {
      return { allowed: false, remaining: 0 };
    }

    if (user.singleUseExtractionsRemaining <= 0) {
      return { allowed: false, remaining: 0 };
    }

    // Consume one extraction
    await tx.user.update({
      where: { id: userId },
      data: { singleUseExtractionsRemaining: { decrement: 1 } },
    });

    return {
      allowed: true,
      remaining: user.singleUseExtractionsRemaining - 1,
    };
  });
}

/**
 * Check and consume a single-use draft credit
 * Returns whether the operation was allowed and remaining credits
 */
export async function checkAndConsumeSingleUseDraft(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        singleUseDraftsRemaining: true,
        singleUseExpiresAt: true,
      },
    });

    if (!user) {
      return { allowed: false, remaining: 0 };
    }

    // Check expiration
    if (user.singleUseExpiresAt && new Date() > user.singleUseExpiresAt) {
      return { allowed: false, remaining: 0 };
    }

    if (user.singleUseDraftsRemaining <= 0) {
      return { allowed: false, remaining: 0 };
    }

    // Consume one draft
    await tx.user.update({
      where: { id: userId },
      data: { singleUseDraftsRemaining: { decrement: 1 } },
    });

    return {
      allowed: true,
      remaining: user.singleUseDraftsRemaining - 1,
    };
  });
}
