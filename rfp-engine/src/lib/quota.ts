import { prisma } from "./prisma";
import { QUOTA_LIMITS } from "./constants";

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
      user.plan === "PRO"
        ? QUOTA_LIMITS.PRO
        : user.plan === "TEAM"
        ? QUOTA_LIMITS.TEAM
        : user.plan === "SOLO"
        ? QUOTA_LIMITS.SOLO
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
