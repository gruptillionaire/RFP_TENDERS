/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for subscription management.
 * Allows users to update payment method, view invoices, cancel subscription.
 *
 * SECURITY:
 * - Requires authenticated user with existing Stripe customer ID
 * - Validates customer ownership before creating portal session
 * - Rate limited to prevent abuse
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBillingPortalSession } from "@/lib/stripe";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

// Rate limiting: max 10 portal requests per user per hour
const portalAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = portalAttempts.get(userId);

  if (!record || now > record.resetAt) {
    portalAttempts.set(userId, { count: 1, resetAt: now + 3600000 }); // 1 hour
    return true;
  }

  if (record.count >= 10) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        stripeCustomerId: true,
        plan: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Must have Stripe customer ID
    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Please subscribe to a plan first." },
        { status: 400 }
      );
    }

    // Build return URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const returnUrl = `${baseUrl}/settings/billing`;

    // Create portal session
    const portalSession = await createBillingPortalSession(
      user.stripeCustomerId,
      returnUrl
    );

    // Audit log
    await logAudit({
      userId: user.id,
      action: AuditAction.BILLING_PORTAL_ACCESSED,
      resource: AuditResource.SUBSCRIPTION,
      details: {
        portalSessionId: portalSession.id,
      },
      request,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
