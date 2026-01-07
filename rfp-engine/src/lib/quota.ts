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
 */
export async function checkAndIncrementQuota(
  userId: string,
  increment: boolean = false
): Promise<QuotaCheckResult> {
  const user = await prisma.user.findUnique({
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

  let currentUsage = user.monthlyExtractionsUsed;

  if (shouldReset) {
    // Reset usage at start of new billing period
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyExtractionsUsed: 0,
        lastUsageReset: now,
      },
    });
    currentUsage = 0;
  }

  // Get limit based on plan
  const limit =
    user.plan === "PRO"
      ? QUOTA_LIMITS.PRO
      : user.monthlyExtractionsLimit || QUOTA_LIMITS.FREE;

  // PRO users have unlimited (-1 means no limit)
  const isUnlimited = limit === -1;
  const allowed = isUnlimited || currentUsage < limit;
  const remaining = isUnlimited ? -1 : Math.max(0, limit - currentUsage);

  // Increment usage if requested and allowed
  if (increment && allowed) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyExtractionsUsed: { increment: 1 },
      },
    });
  }

  return {
    allowed,
    used: currentUsage,
    limit: isUnlimited ? -1 : limit,
    remaining,
  };
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
