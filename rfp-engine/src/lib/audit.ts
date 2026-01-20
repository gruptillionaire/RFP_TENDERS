import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Audit log action types
export const AuditAction = {
  // User authentication
  USER_LOGIN: "user.login",
  USER_LOGIN_FAILED: "user.login_failed",
  USER_LOGOUT: "user.logout",
  USER_SIGNUP: "user.signup",
  USER_PASSWORD_CHANGE: "user.password_change",

  // Password reset
  PASSWORD_RESET_REQUESTED: "password.reset_requested",
  PASSWORD_RESET_COMPLETED: "password.reset_completed",
  PASSWORD_RESET_FAILED: "password.reset_failed",

  // User data rights
  USER_EXPORT_REQUESTED: "user.export_requested",
  USER_EXPORT_COMPLETED: "user.export_completed",
  USER_DELETE_REQUESTED: "user.delete_requested",
  USER_DELETE_COMPLETED: "user.delete_completed",
  USER_PROFILE_UPDATE: "user.profile_update",

  // Consent
  CONSENT_GRANTED: "consent.granted",
  CONSENT_REVOKED: "consent.revoked",

  // Project actions
  PROJECT_CREATE: "project.create",
  PROJECT_UPDATE: "project.update",
  PROJECT_DELETE: "project.delete",

  // Requirement actions
  REQUIREMENT_UPDATE: "requirement.update",
  REQUIREMENT_DELETE: "requirement.delete",
  REQUIREMENT_GENERATE_DRAFT: "requirement.generate_draft",

  // CCPA
  CCPA_OPTOUT: "ccpa.optout",
  CCPA_OPTIN: "ccpa.optin",

  // Billing
  BILLING_CHECKOUT_CREATED: "billing.checkout.created",
  BILLING_CHECKOUT_COMPLETED: "billing.checkout.completed",
  BILLING_SUBSCRIPTION_UPDATED: "billing.subscription.updated",
  BILLING_SUBSCRIPTION_CANCELLED: "billing.subscription.cancelled",
  BILLING_PAYMENT_SUCCEEDED: "billing.payment.succeeded",
  BILLING_PAYMENT_FAILED: "billing.payment.failed",
  BILLING_PORTAL_ACCESSED: "billing.portal.accessed",
  BILLING_CREDITS_EXPIRED: "billing.credits.expired",

  // Library (Past Responses)
  LIBRARY_RESPONSE_CREATE: "library.response.create",
  LIBRARY_RESPONSE_UPDATE: "library.response.update",
  LIBRARY_RESPONSE_DELETE: "library.response.delete",
  LIBRARY_RESPONSE_USED: "library.response.used",

  // Two-Factor Authentication
  USER_2FA_ENABLED: "user.2fa.enabled",
  USER_2FA_DISABLED: "user.2fa.disabled",
  USER_2FA_BACKUP_CODES_REGENERATED: "user.2fa.backup_codes_regenerated",

  // Email Verification
  USER_EMAIL_VERIFIED: "user.email_verified",
} as const;

// Alias for easier imports
export const AuditActions = AuditAction;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

// Resource types for audit logging
export const AuditResource = {
  USER: "user",
  PROJECT: "project",
  REQUIREMENT: "requirement",
  CONSENT: "consent",
  SUBSCRIPTION: "subscription",
  INVOICE: "invoice",
  LIBRARY: "library",
} as const;

export type AuditResourceType =
  (typeof AuditResource)[keyof typeof AuditResource];

interface AuditLogParams {
  userId?: string | null;
  action: AuditActionType;
  resource?: AuditResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  request?: Request;
}

/**
 * Extract IP address from request headers
 * Handles various proxy configurations
 */
function getIpAddress(request?: Request): string | null {
  if (!request) return null;

  // Check common proxy headers
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    // Take the first IP (original client)
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp.trim();
  }

  // CF-Connecting-IP for Cloudflare
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return null;
}

/**
 * Extract user agent from request
 */
function getUserAgent(request?: Request): string | null {
  if (!request) return null;
  return request.headers.get("user-agent");
}

/**
 * Log an audit event to the database
 * This function is designed to never throw - failures are logged but don't block operations
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  const { userId, action, resource, resourceId, details, request } = params;

  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        resource: resource || null,
        resourceId: resourceId || null,
        details: details as Prisma.InputJsonValue | undefined,
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request),
      },
    });
  } catch (error) {
    // Log to console but don't throw - audit logging should never break main functionality
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Log a consent event
 * Creates both an audit log and a consent log entry
 */
export async function logConsent(params: {
  userId: string;
  consentType: "terms" | "privacy" | "marketing" | "cookies" | "dpa";
  granted: boolean;
  version: string;
  request?: Request;
}): Promise<void> {
  const { userId, consentType, granted, version, request } = params;

  try {
    // Create consent log entry
    await prisma.consentLog.create({
      data: {
        userId,
        consentType,
        granted,
        version,
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request),
      },
    });

    // Also create audit log entry
    await logAudit({
      userId,
      action: granted ? AuditAction.CONSENT_GRANTED : AuditAction.CONSENT_REVOKED,
      resource: AuditResource.CONSENT,
      details: { consentType, version },
      request,
    });
  } catch (error) {
    console.error("Failed to log consent:", error);
  }
}

/**
 * Batch log multiple audit events
 * Useful for bulk operations
 */
export async function logAuditBatch(
  events: Array<Omit<AuditLogParams, "request"> & { ipAddress?: string; userAgent?: string }>
): Promise<void> {
  try {
    await prisma.auditLog.createMany({
      data: events.map((event) => ({
        userId: event.userId || null,
        action: event.action,
        resource: event.resource || null,
        resourceId: event.resourceId || null,
        details: event.details as Prisma.InputJsonValue | undefined,
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
      })),
    });
  } catch (error) {
    console.error("Failed to create batch audit logs:", error);
  }
}

/**
 * Get audit logs for a specific user
 * Used for data export and admin review
 */
export async function getAuditLogsForUser(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<{
  logs: Array<{
    id: string;
    action: string;
    resource: string | null;
    resourceId: string | null;
    details: unknown;
    createdAt: Date;
  }>;
  total: number;
}> {
  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { userId },
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        details: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where: { userId } }),
  ]);

  return { logs, total };
}

/**
 * Get consent history for a user
 * Used for compliance verification and data export
 */
export async function getConsentHistory(userId: string): Promise<
  Array<{
    id: string;
    consentType: string;
    granted: boolean;
    version: string;
    createdAt: Date;
  }>
> {
  return prisma.consentLog.findMany({
    where: { userId },
    select: {
      id: true,
      consentType: true,
      granted: true,
      version: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
