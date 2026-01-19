import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { checkLoginRateLimit, resetLoginAttempts } from "./rate-limit";

// Extend the Session type to include emailVerified
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      emailVerified?: Date | null;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true, // Required for Vercel preview deployments - uses request host instead of NEXTAUTH_URL
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

        // Check rate limit (Redis-based)
        const rateLimit = await checkLoginRateLimit(email);
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
        await resetLoginAttempts(email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          rememberMe,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified;
        // Set extended expiry for "Remember Me" sessions (30 days vs 24 hours)
        if ((user as { rememberMe?: boolean }).rememberMe) {
          token.rememberMe = true;
          // Extend token expiry to 30 days
          const thirtyDays = 30 * 24 * 60 * 60;
          token.exp = Math.floor(Date.now() / 1000) + thirtyDays;
        }
      }

      // Refresh emailVerified from database when:
      // 1. Explicit update trigger, OR
      // 2. User is currently unverified (so we can detect when they verify)
      // Note: Only run when !user (not initial sign-in) to avoid login issues
      const shouldRefresh = token.id && !user && (trigger === "update" || !token.emailVerified);
      if (shouldRefresh) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { emailVerified: true },
          });
          if (dbUser) {
            token.emailVerified = dbUser.emailVerified;
          }
        } catch (error) {
          console.error("[auth] Failed to refresh emailVerified:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.emailVerified = token.emailVerified as Date | null;
      }
      return session;
    },
  },
});
