import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CSRF protection: Verify origin for state-changing requests
function verifyOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Skip for GET and HEAD requests (safe methods)
  if (request.method === "GET" || request.method === "HEAD") {
    return true;
  }

  // For state-changing requests, verify origin matches host
  if (!origin) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        return refererUrl.host === host;
      } catch {
        return false;
      }
    }
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  // CSRF protection for API routes (skip webhooks)
  if (req.nextUrl.pathname.startsWith("/api/") &&
      !req.nextUrl.pathname.startsWith("/api/billing/webhook")) {
    if (!verifyOrigin(req)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  }

  // Use lightweight JWT verification (no Prisma/bcrypt imports)
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const isLoggedIn = !!token;

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

  // Note: Email verification is checked in pages/API routes directly (not middleware)
  // This avoids stale JWT token issues since routes can query the database

  return NextResponse.next();
}

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
