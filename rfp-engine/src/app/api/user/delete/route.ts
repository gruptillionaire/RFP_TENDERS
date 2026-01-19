import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AuditAction, AuditResource } from "@/lib/audit";
import { rateLimiters, rateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting (3 per hour)
    const rateLimit = await rateLimiters.delete(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const userId = session.user.id;

    // Log the deletion request first (before deleting data)
    await logAudit({
      userId,
      action: AuditAction.USER_DELETE_REQUESTED,
      resource: AuditResource.USER,
      resourceId: userId,
      request,
    });

    // Get user data summary for audit before deletion
    const userSummary = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        createdAt: true,
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    // For GDPR compliance, we have two options:
    // 1. Immediate deletion (implemented here)
    // 2. Soft delete with grace period (can be added later)

    // Delete all user data (cascading delete will handle related records)
    // The schema has onDelete: Cascade set for related models
    await prisma.user.delete({
      where: { id: userId },
    });

    // Create an anonymized audit log entry for the deletion
    // (User is already deleted, so we use null userId)
    await prisma.auditLog.create({
      data: {
        userId: null, // User no longer exists
        action: AuditAction.USER_DELETE_COMPLETED,
        resource: AuditResource.USER,
        details: {
          deletedUserEmail: anonymizeEmail(userSummary?.email || ""),
          accountAge: userSummary?.createdAt
            ? Math.floor((Date.now() - userSummary.createdAt.getTime()) / (1000 * 60 * 60 * 24))
            : null,
          projectCount: userSummary?._count.projects || 0,
        },
        ipAddress: getIpAddress(request),
        userAgent: request.headers.get("user-agent"),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account. Please try again or contact support." },
      { status: 500 }
    );
  }
}

/**
 * Anonymize email for audit log (keep domain for statistics)
 */
function anonymizeEmail(email: string): string {
  if (!email || !email.includes("@")) return "***@***.***";
  const [, domain] = email.split("@");
  return `***@${domain}`;
}

/**
 * Extract IP address from request
 */
function getIpAddress(request: Request): string | null {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp.trim();
  }
  return null;
}
