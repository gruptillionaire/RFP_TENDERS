/**
 * Authenticated API Route Helpers with RLS Support
 *
 * This module provides wrapper functions for API routes that:
 * 1. Verify authentication
 * 2. Set RLS context for database isolation
 * 3. Handle common error cases
 *
 * Usage:
 * ```typescript
 * import { withAuth } from "@/lib/api-auth";
 *
 * export const GET = withAuth(async (req, session) => {
 *   // session.user.id is guaranteed to be set
 *   // RLS context is already set for database queries
 *   const projects = await prisma.project.findMany();
 *   return NextResponse.json(projects);
 * });
 * ```
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setRLSContext, clearRLSContext } from "@/lib/prisma";

// Session type with user.id
interface AuthenticatedSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

type AuthenticatedHandler = (
  request: NextRequest,
  session: AuthenticatedSession,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Wrapper for authenticated API routes with automatic RLS context.
 *
 * @param handler - The API handler function
 * @returns A wrapped handler that checks auth and sets RLS context
 *
 * @example
 * ```typescript
 * export const GET = withAuth(async (req, session) => {
 *   // RLS context is automatically set
 *   const projects = await prisma.project.findMany();
 *   return NextResponse.json(projects);
 * });
 * ```
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: NextRequest,
    context?: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    try {
      // Get session
      const session = await auth();

      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Set RLS context for database isolation
      await setRLSContext(session.user.id);

      try {
        // Execute the handler
        return await handler(request, session as AuthenticatedSession, context);
      } finally {
        // Always clear RLS context after request
        await clearRLSContext();
      }
    } catch (error) {
      console.error("[API] Error in authenticated handler:", error);

      // Clear RLS context on error too
      try {
        await clearRLSContext();
      } catch {
        // Ignore cleanup errors
      }

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Wrapper for routes that need auth but also work without it (e.g., public + private data).
 * Sets RLS context only if authenticated.
 */
export function withOptionalAuth(
  handler: (
    request: NextRequest,
    session: AuthenticatedSession | null,
    context?: { params: Record<string, string> }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context?: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    try {
      const session = await auth();

      if (session?.user?.id) {
        await setRLSContext(session.user.id);
      }

      try {
        return await handler(
          request,
          session?.user?.id ? (session as AuthenticatedSession) : null,
          context
        );
      } finally {
        if (session?.user?.id) {
          await clearRLSContext();
        }
      }
    } catch (error) {
      console.error("[API] Error in handler:", error);

      try {
        await clearRLSContext();
      } catch {
        // Ignore cleanup errors
      }

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Helper to get session and set RLS context manually.
 * Use this when you can't use the withAuth wrapper.
 *
 * @returns Session with user.id or null
 *
 * @example
 * ```typescript
 * const session = await getAuthSession();
 * if (!session) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * // RLS context is now set, proceed with queries
 * ```
 */
export async function getAuthSession(): Promise<AuthenticatedSession | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Set RLS context
  await setRLSContext(session.user.id);

  return session as AuthenticatedSession;
}

/**
 * Clear RLS context - call this when done with authenticated operations.
 */
export { clearRLSContext } from "@/lib/prisma";
