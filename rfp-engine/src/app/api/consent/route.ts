import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logConsent, logAudit, AuditAction, AuditResource } from "@/lib/audit";

// Current consent version - increment when policies change
const CONSENT_VERSION = "1.0";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const { consentType, granted, preferences } = await request.json();

    // Validate consent type
    const validConsentTypes = ["terms", "privacy", "marketing", "cookies", "dpa"];
    if (!validConsentTypes.includes(consentType)) {
      return NextResponse.json({ error: "Invalid consent type" }, { status: 400 });
    }

    // Only log to database if user is authenticated
    if (session?.user?.id) {
      await logConsent({
        userId: session.user.id,
        consentType,
        granted: granted ?? true,
        version: CONSENT_VERSION,
        request,
      });

      // If this is cookie consent with preferences, log additional details in the audit
      if (consentType === "cookies" && preferences) {
        // Log cookie preferences as part of audit (not as separate consent entries)
        await logAudit({
          userId: session.user.id,
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Consent logging error:", error);
    // Don't fail the request - consent is also stored locally
    return NextResponse.json({ success: true });
  }
}
