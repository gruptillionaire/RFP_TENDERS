import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// =============================================================================
// ROW-LEVEL SECURITY (RLS) SUPPORT
// =============================================================================

/**
 * Set the RLS context for the current user.
 * Call this at the start of each authenticated API request.
 *
 * @param userId - The authenticated user's ID
 */
export async function setRLSContext(userId: string): Promise<void> {
  if (!userId || typeof userId !== "string") {
    console.warn("[RLS] setRLSContext called with invalid userId:", userId);
    return;
  }
  // Sanitize userId to prevent injection (extra safety layer)
  const sanitizedUserId = userId.replace(/['"\\]/g, "");
  await prisma.$executeRaw`SELECT set_config('app.current_user_id', ${sanitizedUserId}, false)`;
}

/**
 * Clear the RLS context (for cleanup or service operations).
 */
export async function clearRLSContext(): Promise<void> {
  await prisma.$executeRaw`SELECT set_config('app.current_user_id', '', false)`;
}

/**
 * Execute a function with RLS context, ensuring cleanup afterward.
 */
export async function withRLSContext<T>(
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  await setRLSContext(userId);
  try {
    return await fn();
  } finally {
    await clearRLSContext();
  }
}
