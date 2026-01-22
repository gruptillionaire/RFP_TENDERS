import { prisma } from "./prisma";
import { QUOTA_LIMITS, DRAFT_LIMITS } from "./constants";

interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Check if a manually granted subscription has expired.
 * A subscription is considered "granted" (not Stripe-managed) when:
 * - User has a paid plan (STARTER, PRO, BUSINESS)
 * - User has no stripeSubscriptionId
 * - User has a currentPeriodEnd date
 *
 * Returns true if the grant has expired and user should be treated as FREE.
 */
function isGrantedSubscriptionExpired(
  plan: string,
  stripeSubscriptionId: string | null,
  currentPeriodEnd: Date | null
): boolean {
  // Only check for paid plans that are manually granted (no Stripe subscription)
  const isPaidPlan = ["STARTER", "PRO", "BUSINESS"].includes(plan);
  const isGranted = !stripeSubscriptionId;

  if (!isPaidPlan || !isGranted) {
    return false;
  }

  // If no expiration date, treat as not expired (shouldn't happen but be safe)
  if (!currentPeriodEnd) {
    return false;
  }

  return new Date() > currentPeriodEnd;
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
        stripeSubscriptionId: true,
        currentPeriodEnd: true,
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

    // Check if this is an expired granted subscription
    const grantExpired = isGrantedSubscriptionExpired(
      user.plan,
      user.stripeSubscriptionId,
      user.currentPeriodEnd
    );

    // Get limit based on plan
    // FREE plan always gets 0 - no fallback to monthlyExtractionsLimit
    // Expired grants are treated as FREE
    const effectivePlan = grantExpired ? "FREE" : user.plan;
    const limit =
      effectivePlan === "FREE"
        ? QUOTA_LIMITS.FREE
        : effectivePlan === "ENTERPRISE"
        ? QUOTA_LIMITS.ENTERPRISE
        : effectivePlan === "BUSINESS"
        ? QUOTA_LIMITS.BUSINESS
        : effectivePlan === "PRO"
        ? QUOTA_LIMITS.PRO
        : effectivePlan === "STARTER"
        ? QUOTA_LIMITS.STARTER
        : QUOTA_LIMITS.FREE;

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

// =============================================================================
// COMBINED DASHBOARD QUERY (OPTIMIZED)
// =============================================================================

interface DashboardUserData {
  plan: string;
  emailVerified: Date | null;
  quota: QuotaCheckResult;
  singleUseQuota: SingleUseQuotaResult;
}

/**
 * Get all user data needed for dashboard in a single query
 * Avoids multiple round trips to database
 */
export async function getDashboardUserData(userId: string): Promise<DashboardUserData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      emailVerified: true,
      monthlyExtractionsUsed: true,
      monthlyExtractionsLimit: true,
      lastUsageReset: true,
      singleUseExtractionsRemaining: true,
      singleUseDraftsRemaining: true,
      singleUseExpiresAt: true,
      stripeSubscriptionId: true,
      currentPeriodEnd: true,
    },
  });

  if (!user) return null;

  // Calculate quota status from fetched data (no extra query)
  const now = new Date();
  const lastReset = new Date(user.lastUsageReset);
  const shouldReset = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();

  const currentUsage = shouldReset ? 0 : user.monthlyExtractionsUsed;

  // Check if this is an expired granted subscription
  const grantExpired = isGrantedSubscriptionExpired(
    user.plan,
    user.stripeSubscriptionId,
    user.currentPeriodEnd
  );

  // FREE plan always gets 0 - no fallback to monthlyExtractionsLimit
  // Expired grants are treated as FREE
  const effectivePlan = grantExpired ? "FREE" : user.plan;
  const limit =
    effectivePlan === "FREE" ? QUOTA_LIMITS.FREE :
    effectivePlan === "ENTERPRISE" ? QUOTA_LIMITS.ENTERPRISE :
    effectivePlan === "BUSINESS" ? QUOTA_LIMITS.BUSINESS :
    effectivePlan === "PRO" ? QUOTA_LIMITS.PRO :
    effectivePlan === "STARTER" ? QUOTA_LIMITS.STARTER :
    QUOTA_LIMITS.FREE;

  const isUnlimited = limit === -1;
  const remaining = isUnlimited ? -1 : Math.max(0, limit - currentUsage);

  // Calculate single-use quota from fetched data (no extra query)
  const isExpired = user.singleUseExpiresAt ? now > user.singleUseExpiresAt : false;

  return {
    // Return effective plan so UI shows correct state
    plan: effectivePlan,
    emailVerified: user.emailVerified,
    quota: {
      allowed: isUnlimited || currentUsage < limit,
      used: currentUsage,
      limit: isUnlimited ? -1 : limit,
      remaining,
    },
    singleUseQuota: {
      hasCredits: user.singleUseExtractionsRemaining > 0 && !isExpired,
      extractionsRemaining: isExpired ? 0 : user.singleUseExtractionsRemaining,
      draftsRemaining: isExpired ? 0 : user.singleUseDraftsRemaining,
      expiresAt: user.singleUseExpiresAt,
      isExpired,
    },
  };
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
        stripeSubscriptionId: true,
        currentPeriodEnd: true,
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

    // Check if this is an expired granted subscription
    const grantExpired = isGrantedSubscriptionExpired(
      user.plan,
      user.stripeSubscriptionId,
      user.currentPeriodEnd
    );

    // Get limit based on plan - FREE always gets 0
    // Expired grants are treated as FREE
    const effectivePlan = grantExpired ? "FREE" : user.plan;
    const limit =
      effectivePlan === "FREE"
        ? DRAFT_LIMITS.FREE
        : effectivePlan === "ENTERPRISE"
        ? DRAFT_LIMITS.ENTERPRISE
        : effectivePlan === "BUSINESS"
        ? DRAFT_LIMITS.BUSINESS
        : effectivePlan === "PRO"
        ? DRAFT_LIMITS.PRO
        : effectivePlan === "STARTER"
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
