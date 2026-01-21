"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getCookieConsent } from "@/lib/cookies";

/**
 * Conditionally renders Vercel Analytics and SpeedInsights
 * based on user cookie consent.
 *
 * Analytics will only load after the user has explicitly
 * consented to analytics cookies via the cookie banner.
 */
export function ConditionalAnalytics() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const checkConsent = () => {
      const consent = getCookieConsent();
      setAnalyticsEnabled(consent?.analytics === true);
    };

    // Check on mount
    checkConsent();

    // Listen for consent changes (custom event from CookieConsent component)
    const handleConsentChange = () => {
      checkConsent();
    };

    window.addEventListener("cookie-consent-changed", handleConsentChange);

    // Also check periodically in case localStorage changes
    const interval = setInterval(checkConsent, 1000);

    return () => {
      window.removeEventListener("cookie-consent-changed", handleConsentChange);
      clearInterval(interval);
    };
  }, []);

  if (!analyticsEnabled) {
    return null;
  }

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
