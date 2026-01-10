import posthog from "posthog-js";

let initialized = false;

/**
 * Initialize PostHog analytics
 * Only runs on client-side and when API key is configured
 */
export function initPostHog() {
  if (typeof window === "undefined") return;
  if (initialized) return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        ph.debug();
      }
    },
    // Disable automatic pageview tracking - we'll do it manually for more control
    capture_pageview: false,
    // Use localStorage for persistence
    persistence: "localStorage",
    // Disable autocapture for privacy - only track what we explicitly capture
    autocapture: false,
    // Respect Do Not Track browser setting
    respect_dnt: true,
  });

  initialized = true;
}

/**
 * Check if PostHog is initialized and ready to use
 */
export function isPostHogReady(): boolean {
  return initialized && typeof window !== "undefined";
}

/**
 * Capture a custom event
 */
export function captureEvent(
  eventName: string,
  properties?: Record<string, unknown>
) {
  if (!isPostHogReady()) return;
  posthog.capture(eventName, properties);
}

/**
 * Capture a pageview
 */
export function capturePageview(path: string) {
  if (!isPostHogReady()) return;
  posthog.capture("$pageview", { $current_url: path });
}

/**
 * Identify a user (call after login)
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!isPostHogReady()) return;
  posthog.identify(userId, properties);
}

/**
 * Reset user identity (call after logout)
 */
export function resetUser() {
  if (!isPostHogReady()) return;
  posthog.reset();
}

// Pre-defined event names for consistency
export const AnalyticsEvents = {
  // Project events
  PROJECT_CREATED: "project_created",
  PROJECT_DELETED: "project_deleted",

  // Requirement events
  REQUIREMENT_DRAFTED: "requirement_drafted",
  REQUIREMENT_UPDATED: "requirement_updated",

  // Library events
  LIBRARY_ITEM_SAVED: "library_item_saved",
  LIBRARY_ITEM_USED: "library_item_used",
  LIBRARY_ITEM_DELETED: "library_item_deleted",

  // Export events
  EXPORT_STARTED: "export_started",
  EXPORT_COMPLETED: "export_completed",

  // Auth events
  USER_SIGNED_UP: "user_signed_up",
  USER_LOGGED_IN: "user_logged_in",
  TWO_FA_ENABLED: "2fa_enabled",
  TWO_FA_DISABLED: "2fa_disabled",

  // Billing events
  CHECKOUT_STARTED: "checkout_started",
  SUBSCRIPTION_UPGRADED: "subscription_upgraded",
} as const;

export { posthog };
