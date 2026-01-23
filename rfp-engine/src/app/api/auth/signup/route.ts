import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logConsent, logAudit, AuditAction, AuditResource } from "@/lib/audit";
import { rateLimiters } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

// Current policy versions - increment when policies change
const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

// Security constants
const MAX_EMAIL_LENGTH = 255;
const MAX_NAME_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// Password strength validation
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters` };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character" };
  }
  return { valid: true };
}

// Generate a unique referral code (6 alphanumeric chars)
function generateReferralCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Email validation
function validateEmail(email: string): { valid: boolean; normalized?: string; error?: string } {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required" };
  }

  // Normalize: trim and lowercase
  const normalized = email.toLowerCase().trim();

  if (normalized.length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: `Email must not exceed ${MAX_EMAIL_LENGTH} characters` };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true, normalized };
}

export async function POST(request: Request) {
  try {
    // Rate limiting - get IP from headers (Redis-based)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

    const rateLimit = await rateLimiters.signup(ip);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      );
    }

    const { email, password, name, acceptTerms, acceptPrivacy, acceptMarketing, referralCode } = await request.json();

    // Validate consent - Terms and Privacy are required
    if (!acceptTerms || !acceptPrivacy) {
      return NextResponse.json(
        { error: "You must accept the Terms of Service and Privacy Policy" },
        { status: 400 }
      );
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400 }
      );
    }
    const normalizedEmail = emailValidation.normalized!;

    // Validate password
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Validate name length if provided
    if (name && typeof name === "string" && name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name must not exceed ${MAX_NAME_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Check if user already exists (use normalized email)
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in or use a different email." },
        { status: 400 }
      );
    }

    // Hash password with strong salt rounds
    const passwordHash = await bcrypt.hash(password, 12);

    const now = new Date();

    // Look up referrer if a referral code was provided
    let referrerId: string | null = null;
    if (referralCode && typeof referralCode === "string") {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referralCode.toLowerCase().trim() },
        select: { id: true },
      });
      if (referrer) {
        referrerId = referrer.id;
      }
      // Silently ignore invalid referral codes - don't block signup
    }

    // Generate a unique referral code for this user (retry if collision)
    let newUserReferralCode: string;
    let attempts = 0;
    do {
      newUserReferralCode = generateReferralCode();
      const existing = await prisma.user.findUnique({
        where: { referralCode: newUserReferralCode },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 5);

    // Create user with normalized email and consent timestamps
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || null,
        passwordHash,
        termsAcceptedAt: now,
        privacyPolicyAcceptedAt: now,
        marketingConsentGiven: acceptMarketing || false,
        referralCode: newUserReferralCode,
        referredByUserId: referrerId,
      },
    });

    // Log consent events for audit trail
    await Promise.all([
      logConsent({
        userId: user.id,
        consentType: "terms",
        granted: true,
        version: TERMS_VERSION,
        request,
      }),
      logConsent({
        userId: user.id,
        consentType: "privacy",
        granted: true,
        version: PRIVACY_VERSION,
        request,
      }),
      acceptMarketing && logConsent({
        userId: user.id,
        consentType: "marketing",
        granted: true,
        version: "1.0",
        request,
      }),
      logAudit({
        userId: user.id,
        action: AuditAction.USER_SIGNUP,
        resource: AuditResource.USER,
        resourceId: user.id,
        request,
      }),
    ].filter(Boolean));

    // Generate email verification token (32 bytes = 64 hex chars)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create verification token in database
    await prisma.emailVerificationToken.create({
      data: {
        email: normalizedEmail,
        token: verificationToken,
        expiresAt: tokenExpiresAt,
      },
    });

    // Send verification email (non-blocking, don't fail signup if email fails)
    sendVerificationEmail({
      email: normalizedEmail,
      userName: user.name,
      verificationToken,
    }).catch((error) => {
      console.error("Failed to send verification email:", error);
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerificationSent: true,
    });
  } catch (error) {
    console.error("Signup error:", error);

    // Handle specific error types with user-friendly messages
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid request data. Please refresh and try again." },
        { status: 400 }
      );
    }

    // Prisma unique constraint violation (email already exists)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in or use a different email." },
        { status: 400 }
      );
    }

    // Database connection issues
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "P1001" || error.code === "P1002")
    ) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again in a few moments." },
        { status: 503 }
      );
    }

    // Generic fallback - avoid leaking sensitive information
    return NextResponse.json(
      { error: "Unable to create account. Please check all fields and try again." },
      { status: 500 }
    );
  }
}
