import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions in dev, reduce in production

  // Session Replay (optional - captures user sessions for debugging)
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "originalCreateNotification",
    "canvas.contentDocument",
    "MyApp_RemoveAllHighlights",
    "http://tt.teletrader.cn/",
    "jigsaw is not defined",
    "ComboSearch is not defined",
    "atomicFindClose",
    // Facebook
    "fb_xd_fragment",
    // Network errors
    "Network request failed",
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    // User abort
    "AbortError",
    "The operation was aborted",
    // Safari
    "The operation couldn't be completed",
  ],

  // Filter out events from browser extensions
  beforeSend(event) {
    // Check if the error is from a browser extension
    if (event.exception?.values?.[0]?.stacktrace?.frames) {
      const frames = event.exception.values[0].stacktrace.frames;
      const isExtensionError = frames.some(
        (frame) =>
          frame.filename?.includes("chrome-extension://") ||
          frame.filename?.includes("moz-extension://") ||
          frame.filename?.includes("safari-extension://")
      );
      if (isExtensionError) {
        return null;
      }
    }
    return event;
  },
});
