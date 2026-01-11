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
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/dashboard") ||
                          req.nextUrl.pathname.startsWith("/projects") ||
                          req.nextUrl.pathname.startsWith("/settings") ||
                          req.nextUrl.pathname.startsWith("/library");

  // Redirect logged in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/settings/:path*",
    "/library/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/api/:path*", // Include API routes for CSRF protection
  ],
};
