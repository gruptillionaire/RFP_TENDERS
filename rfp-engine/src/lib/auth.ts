import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number; lockedUntil?: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout after max attempts

function checkLoginRateLimit(email: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const key = email.toLowerCase().trim();
  const record = loginAttempts.get(key);

  // Check if account is locked out
  if (record?.lockedUntil && record.lockedUntil > now) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return {
      allowed: false,
      message: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
    };
  }

  // Reset if window expired
  if (!record || record.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  // Check if max attempts reached
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    // Lock the account
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return {
      allowed: false,
      message: "Too many failed attempts. Account temporarily locked for 15 minutes.",
    };
  }

  record.count++;
  return { allowed: true };
}

function resetLoginAttempts(email: string): void {
  loginAttempts.delete(email.toLowerCase().trim());
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Refresh token every hour
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember Me", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Normalize email
        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;
        const rememberMe = credentials.rememberMe === "true";

        // Check rate limit
        const rateLimit = checkLoginRateLimit(email);
        if (!rateLimit.allowed) {
          // NextAuth doesn't support custom error messages well in authorize
          // The rate limit will still prevent brute force
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          // Use constant-time comparison behavior to prevent timing attacks
          // Even if user doesn't exist, we simulate password check delay
          await bcrypt.compare(password, "$2a$12$invalid.hash.to.prevent.timing.attacks");
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        // Reset rate limit on successful login
        resetLoginAttempts(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          rememberMe,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Set extended expiry for "Remember Me" sessions (30 days vs 24 hours)
        if ((user as { rememberMe?: boolean }).rememberMe) {
          token.rememberMe = true;
          // Extend token expiry to 30 days
          const thirtyDays = 30 * 24 * 60 * 60;
          token.exp = Math.floor(Date.now() / 1000) + thirtyDays;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
