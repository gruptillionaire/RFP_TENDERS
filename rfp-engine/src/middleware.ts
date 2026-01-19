import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// CSRF protection: Verify origin for state-changing requests
function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Skip for GET and HEAD requests (safe methods)
  if (request.method === "GET" || request.method === "HEAD") {
    return true;
  }

  // For state-changing requests, verify origin matches host
  if (!origin) {
    // Allow requests without origin (e.g., same-origin requests from some browsers)
    // But check referer as fallback
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        return refererUrl.host === host;
      } catch {
        return false;
      }
    }
    // No origin or referer - allow for now but log in production
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

// Routes that require email verification to access
const EMAIL_VERIFICATION_REQUIRED_ROUTES = [
  "/projects",
  "/library",
  "/api/projects",
  "/api/requirements",
  "/api/export",
];

// Routes that unverified users CAN access (auth-related, settings, etc.)
const UNVERIFIED_ALLOWED_ROUTES = [
  "/dashboard",
  "/settings",
  "/verify-email",
  "/api/auth",
  "/api/billing",
  "/api/settings",
  "/api/user",
];

export default auth((req) => {
  // CSRF protection for API routes (skip webhooks which use signature verification)
  if (req.nextUrl.pathname.startsWith("/api/") &&
      !req.nextUrl.pathname.startsWith("/api/billing/webhook")) {
    if (!verifyOrigin(req)) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }
  }

  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") ||
                     req.nextUrl.pathname.startsWith("/signup") ||
                     req.nextUrl.pathname.startsWith("/forgot-password") ||
                     req.nextUrl.pathname.startsWith("/reset-password");
  const isVerifyEmailPage = req.nextUrl.pathname.startsWith("/verify-email");
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/dashboard") ||
                          req.nextUrl.pathname.startsWith("/projects") ||
                          req.nextUrl.pathname.startsWith("/settings") ||
                          req.nextUrl.pathname.startsWith("/library");

  // Redirect logged in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Check email verification for protected routes
  if (isLoggedIn && !isVerifyEmailPage) {
    const emailVerified = req.auth?.user?.emailVerified;

    // Check if this route requires email verification
    const requiresVerification = EMAIL_VERIFICATION_REQUIRED_ROUTES.some(
      (route) => req.nextUrl.pathname.startsWith(route)
    );

    // If route requires verification and user is not verified, redirect
    if (requiresVerification && !emailVerified) {
      // For API routes, return 403
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Email verification required. Please verify your email to access this feature." },
          { status: 403 }
        );
      }

      // For page routes, redirect to verify-email page
      const url = req.nextUrl.clone();
      url.pathname = "/verify-email";
      url.searchParams.set("redirect", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/settings/:path*",
    "/library/:path*",
    "/verify-email",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/api/:path*", // Include API routes for CSRF protection
  ],
};
