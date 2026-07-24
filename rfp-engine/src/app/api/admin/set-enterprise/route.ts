/**
 * POST /api/admin/set-enterprise
 *
 * Admin-only endpoint to set a user to Enterprise plan.
 * Used after closing an enterprise sales deal.
 *
 * SECURITY:
 * - Requires authenticated user
 * - User must be in ADMIN_EMAILS environment variable
 * - Audit logged for compliance
 *
 * Request body:
 * - email: string - The email of the user to upgrade
 * - contractEndDate: string - ISO date when the enterprise contract ends
 * - notes?: string - Optional notes about the deal
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";

// Get admin emails from environment variable (comma-separated)
function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS || "";
  return adminEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function isAdmin(email: string): boolean {
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is an admin
    if (!isAdmin(session.user.email)) {
      console.warn(`Non-admin user ${session.user.id} attempted to access admin endpoint`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, contractEndDate, notes } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!contractEndDate || typeof contractEndDate !== "string") {
      return NextResponse.json(
        { error: "Contract end date is required" },
        { status: 400 }
      );
    }

    // Parse and validate the contract end date
    const endDate = new Date(contractEndDate);
    if (isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid contract end date format" },
        { status: 400 }
      );
    }

    // Find the user to upgrade
    const targetUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, plan: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const previousPlan = targetUser.plan;

    // Update user to Enterprise plan
    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        plan: "ENTERPRISE",
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: endDate,
        cancelAtPeriodEnd: false,
        // Unlimited everything
        monthlyExtractionsLimit: -1,
        // Reset usage counters for fresh start
        monthlyExtractionsUsed: 0,
        monthlyDraftsUsed: 0,
        lastUsageReset: new Date(),
      },
    });

    // Audit log the action
    await logAudit({
      userId: session.user.id,
      action: AuditAction.BILLING_SUBSCRIPTION_UPDATED,
      resource: AuditResource.USER,
      resourceId: targetUser.id,
      details: {
        action: "admin_set_enterprise",
        targetEmail: email,
        previousPlan,
        newPlan: "ENTERPRISE",
        contractEndDate,
        notes: notes || null,
        adminEmail: session.user.email,
      },
    });

    console.log(`Admin ${session.user.id} set user ${targetUser.id} to Enterprise plan`);

    return NextResponse.json({
      success: true,
      message: `User ${email} upgraded to Enterprise plan`,
      user: {
        email: targetUser.email,
        previousPlan,
        newPlan: "ENTERPRISE",
        contractEndDate,
      },
    });
  } catch (error) {
    console.error("Error setting enterprise plan:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to list current enterprise users (for admin dashboard)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const enterpriseUsers = await prisma.user.findMany({
      where: { plan: "ENTERPRISE" },
      select: {
        id: true,
        email: true,
        name: true,
        currentPeriodEnd: true,
        createdAt: true,
        monthlyExtractionsUsed: true,
        monthlyDraftsUsed: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      count: enterpriseUsers.length,
      users: enterpriseUsers,
    });
  } catch (error) {
    console.error("Error fetching enterprise users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
