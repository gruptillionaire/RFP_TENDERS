// Cookie consent configuration
export const COOKIE_CONSENT_KEY = "cookie-consent";
export const COOKIE_CONSENT_VERSION = "1.0";

export interface CookieConsent {
  essential: boolean; // Always true, cannot be disabled
  preferences: boolean;
  analytics: boolean;
  version: string;
  timestamp: string;
}

export const defaultConsent: CookieConsent = {
  essential: true,
  preferences: false,
  analytics: false,
  version: COOKIE_CONSENT_VERSION,
  timestamp: new Date().toISOString(),
};

export const fullConsent: CookieConsent = {
  essential: true,
  preferences: true,
  analytics: true,
  version: COOKIE_CONSENT_VERSION,
  timestamp: new Date().toISOString(),
};

/**
 * Get the current cookie consent from localStorage
 */
export function getCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) return null;

    const consent = JSON.parse(stored) as CookieConsent;

    // Check if consent version matches current version
    if (consent.version !== COOKIE_CONSENT_VERSION) {
      // Consent needs to be re-obtained for new version
      return null;
    }

    return consent;
  } catch {
    return null;
  }
}

/**
 * Set cookie consent in localStorage
 */
export function setCookieConsent(consent: CookieConsent): void {
  if (typeof window === "undefined") return;

  const consentWithTimestamp: CookieConsent = {
    ...consent,
    essential: true, // Always ensure essential is true
    version: COOKIE_CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };

  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentWithTimestamp));
}

/**
 * Check if consent has been given (any choice made)
 */
export function hasConsentBeenGiven(): boolean {
  return getCookieConsent() !== null;
}

/**
 * Check if a specific cookie category is allowed
 */
export function isCookieCategoryAllowed(category: keyof Omit<CookieConsent, "version" | "timestamp">): boolean {
  const consent = getCookieConsent();
  if (!consent) {
    // If no consent, only essential cookies are allowed
    return category === "essential";
  }
  return consent[category];
}

/**
 * Accept all cookies
 */
export function acceptAllCookies(): CookieConsent {
  const consent = fullConsent;
  setCookieConsent(consent);
  return consent;
}

/**
 * Reject non-essential cookies
 */
export function rejectNonEssentialCookies(): CookieConsent {
  const consent = defaultConsent;
  setCookieConsent(consent);
  return consent;
}

/**
 * Set custom cookie preferences
 */
export function setCustomCookiePreferences(preferences: {
  preferences: boolean;
  analytics: boolean;
}): CookieConsent {
  const consent: CookieConsent = {
    essential: true,
    preferences: preferences.preferences,
    analytics: preferences.analytics,
    version: COOKIE_CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };
  setCookieConsent(consent);
  return consent;
}

/**
 * Clear cookie consent (for testing or when user wants to reconfigure)
 */
export function clearCookieConsent(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(COOKIE_CONSENT_KEY);
}

/**
 * Initialize analytics if consent is given
 * Call this after consent is obtained
 *
 * Note: Vercel Analytics is privacy-focused and doesn't require cookies,
 * so it works automatically without needing consent-based initialization.
 * This function is kept for API compatibility with CookieConsent component.
 */
export function initializeAnalyticsIfConsented(): void {
  // Vercel Analytics doesn't need manual initialization - it's automatic
  // This function is kept as a no-op for backwards compatibility
}
