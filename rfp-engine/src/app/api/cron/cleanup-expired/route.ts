/**
 * GET /api/cron/cleanup-expired
 *
 * Daily cron job to clean up expired content and subscriptions.
 * Runs at 2 AM daily.
 *
 * Actions:
 * 1. Delete projects where isSingleUseProject = true AND expiresAt < now
 * 2. Reset expired single-use credits to 0 for users
 * 3. Downgrade expired granted subscriptions (no Stripe ID) to FREE
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

// Cron secret for security - REQUIRED in production
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // SECURITY: Always require cron secret in production
  // This prevents unauthorized triggering of cleanup operations
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRITICAL: CRON_SECRET not configured in production");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }
    console.warn("WARNING: CRON_SECRET not set - cron endpoints are unprotected");
  }

  // Verify cron secret (required when secret is configured)
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    console.log("Unauthorized cron request - invalid or missing authorization header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find and delete expired single-use projects
    const expiredProjects = await prisma.project.findMany({
      where: {
        isSingleUseProject: true,
        expiresAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        name: true,
        userId: true,
        expiresAt: true,
      },
    });

    // Delete expired projects (cascade will handle requirements, exports, etc.)
    if (expiredProjects.length > 0) {
      await prisma.project.deleteMany({
        where: {
          id: {
            in: expiredProjects.map((p) => p.id),
          },
        },
      });

      // Log each deletion
      for (const project of expiredProjects) {
        await logAudit({
          userId: project.userId,
          action: AuditAction.PROJECT_DELETE,
          resource: AuditResource.PROJECT,
          resourceId: project.id,
          details: {
            reason: "single_use_expired",
            projectName: project.name,
            expiresAt: project.expiresAt?.toISOString(),
          },
        });
      }
    }

    // Reset expired single-use credits
    const usersWithExpiredCredits = await prisma.user.findMany({
      where: {
        singleUseExpiresAt: {
          lt: now,
        },
        OR: [
          { singleUseExtractionsRemaining: { gt: 0 } },
          { singleUseDraftsRemaining: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        singleUseExtractionsRemaining: true,
        singleUseDraftsRemaining: true,
        singleUseExpiresAt: true,
      },
    });

    // Reset expired credits
    if (usersWithExpiredCredits.length > 0) {
      await prisma.user.updateMany({
        where: {
          id: {
            in: usersWithExpiredCredits.map((u) => u.id),
          },
        },
        data: {
          singleUseExtractionsRemaining: 0,
          singleUseDraftsRemaining: 0,
        },
      });

      // Log each credit expiration
      for (const user of usersWithExpiredCredits) {
        await logAudit({
          userId: user.id,
          action: AuditAction.BILLING_CREDITS_EXPIRED,
          resource: AuditResource.USER,
          resourceId: user.id,
          details: {
            extractionsExpired: user.singleUseExtractionsRemaining,
            draftsExpired: user.singleUseDraftsRemaining,
            expiresAt: user.singleUseExpiresAt?.toISOString(),
          },
        });
      }
    }

    // Downgrade expired granted subscriptions
    // These are users with paid plans but no Stripe subscription (manually granted)
    // whose currentPeriodEnd has passed
    const expiredGrantedSubscriptions = await prisma.user.findMany({
      where: {
        plan: { in: ["STARTER", "PRO", "BUSINESS"] },
        stripeSubscriptionId: null, // No Stripe subscription = granted
        currentPeriodEnd: {
          lt: now,
        },
      },
      select: {
        id: true,
        email: true,
        plan: true,
        currentPeriodEnd: true,
      },
    });

    // Downgrade to FREE
    if (expiredGrantedSubscriptions.length > 0) {
      await prisma.user.updateMany({
        where: {
          id: {
            in: expiredGrantedSubscriptions.map((u) => u.id),
          },
        },
        data: {
          plan: "FREE",
          subscriptionStatus: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          monthlyExtractionsLimit: 0,
        },
      });

      // Log each subscription expiration
      for (const user of expiredGrantedSubscriptions) {
        await logAudit({
          userId: user.id,
          action: AuditAction.BILLING_SUBSCRIPTION_CANCELLED,
          resource: AuditResource.USER,
          resourceId: user.id,
          details: {
            reason: "granted_subscription_expired",
            previousPlan: user.plan,
            newPlan: "FREE",
            expiredAt: user.currentPeriodEnd?.toISOString(),
          },
        });
        console.log(
          `Expired granted subscription: ${user.email} (${user.plan}) -> FREE`
        );
      }
    }

    console.log(
      `Cleanup completed: ${expiredProjects.length} projects deleted, ${usersWithExpiredCredits.length} users' credits reset, ${expiredGrantedSubscriptions.length} granted subscriptions expired`
    );

    return NextResponse.json({
      success: true,
      projectsDeleted: expiredProjects.length,
      deletedProjects: expiredProjects.map((p) => ({
        id: p.id,
        name: p.name,
      })),
      creditsReset: usersWithExpiredCredits.length,
      subscriptionsExpired: expiredGrantedSubscriptions.length,
      expiredSubscriptions: expiredGrantedSubscriptions.map((u) => ({
        email: u.email,
        previousPlan: u.plan,
        expiredAt: u.currentPeriodEnd?.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Cleanup expired cron error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup expired content" },
      { status: 500 }
    );
  }
}
