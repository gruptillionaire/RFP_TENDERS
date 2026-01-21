import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { logConsent, logAudit, AuditAction, AuditResource } from "@/lib/audit";

// Current consent version - increment when policies change
const CONSENT_VERSION = "1.0";
const ANONYMOUS_SESSION_COOKIE = "rfp_anonymous_id";

/**
 * Generate a unique anonymous session ID for consent tracking
 */
function generateAnonymousId(): string {
  return `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get or create an anonymous session ID for non-authenticated users
 */
async function getOrCreateAnonymousId(): Promise<string> {
  const cookieStore = await cookies();
  const existingId = cookieStore.get(ANONYMOUS_SESSION_COOKIE)?.value;

  if (existingId) {
    return existingId;
  }

  return generateAnonymousId();
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const { consentType, granted, preferences } = await request.json();

    // Validate consent type
    const validConsentTypes = ["terms", "privacy", "marketing", "cookies", "dpa"];
    if (!validConsentTypes.includes(consentType)) {
      return NextResponse.json({ error: "Invalid consent type" }, { status: 400 });
    }

    // Determine the user identifier (authenticated user ID or anonymous session ID)
    const userId = session?.user?.id;
    const anonymousId = !userId ? await getOrCreateAnonymousId() : null;

    // Log consent for authenticated users
    if (userId) {
      await logConsent({
        userId,
        consentType,
        granted: granted ?? true,
        version: CONSENT_VERSION,
        request,
      });

      // If this is cookie consent with preferences, log additional details in the audit
      if (consentType === "cookies" && preferences) {
        await logAudit({
          userId,
          action: AuditAction.CONSENT_GRANTED,
          resource: AuditResource.CONSENT,
          details: {
            type: "cookie_preferences",
            essential: true,
            analytics: preferences.analytics || false,
            preferences: preferences.preferences || false,
            version: CONSENT_VERSION,
          },
          request,
        });
      }
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      anonymousId: anonymousId || undefined,
    });

    // Set anonymous ID cookie for non-authenticated users (for future consent linking)
    if (anonymousId) {
      response.cookies.set(ANONYMOUS_SESSION_COOKIE, anonymousId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60, // 1 year
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Consent logging error:", error);
    // Don't fail the request - consent is also stored locally
    return NextResponse.json({ success: true });
  }
}
