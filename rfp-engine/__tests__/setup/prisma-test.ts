/**
 * Prisma Test Utilities
 * Provides database utilities for integration tests
 */

import { PrismaClient } from '@prisma/client';
import { beforeEach, afterAll } from 'vitest';

// Use a separate Prisma instance for tests to avoid conflicts
let prismaTest: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prismaTest) {
    prismaTest = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.DEBUG_PRISMA ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prismaTest;
}

/**
 * Clean up database tables in the correct order (respecting foreign keys)
 * Call this in beforeEach for a fresh state per test
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  // Disable foreign key checks during cleanup
  // Order matters - delete child tables first
  const deleteOrder = [
    'RequirementVersion',
    'Requirement',
    'ExtractionJob',
    'Project',
    'LibraryItem',
    'AuditLog',
    'SingleUseCredit',
    'Subscription',
    'PasswordResetToken',
    'VerificationToken',
    'Account',
    'Session',
    'User',
  ];

  for (const table of deleteOrder) {
    try {
      // Use raw SQL for faster cleanup
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    } catch {
      // Table might not exist or be empty, continue
    }
  }
}

/**
 * Reset sequences for auto-increment fields
 */
export async function resetSequences(prisma: PrismaClient): Promise<void> {
  // Most tables use UUID, but reset any sequences just in case
  const sequences = [
    'User_id_seq',
    'Project_id_seq',
    'Requirement_id_seq',
  ];

  for (const seq of sequences) {
    try {
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE "${seq}" RESTART WITH 1`);
    } catch {
      // Sequence might not exist
    }
  }
}

/**
 * Setup database hooks for integration tests
 * Usage: setupDatabase() in your test file
 */
export function setupDatabase() {
  const prisma = getTestPrisma();

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    prismaTest = null;
  });

  return prisma;
}

/**
 * Transaction-based test isolation
 * Wraps each test in a transaction that gets rolled back
 * More efficient than cleaning database for each test
 */
export async function withTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    try {
      return await fn(tx as unknown as PrismaClient);
    } finally {
      // Rollback by throwing a known error
      throw new Error('__ROLLBACK__');
    }
  }).catch((error) => {
    if (error.message === '__ROLLBACK__') {
      return undefined as T; // Transaction was intentionally rolled back
    }
    throw error;
  });
}
