# RFP Engine - Security Features Documentation

This document provides a comprehensive overview of all security features implemented in the RFP Engine application. For general product features and roadmap, see `../project-brief.md`.

---

## Table of Contents

1. [Authentication and Session Management](#1-authentication-and-session-management)
2. [Authorization and Access Control](#2-authorization-and-access-control)
3. [Input Validation and Sanitization](#3-input-validation-and-sanitization)
4. [Rate Limiting and Brute Force Protection](#4-rate-limiting-and-brute-force-protection)
5. [CSRF Protection](#5-csrf-protection)
6. [Security Headers](#6-security-headers)
7. [File Upload Security](#7-file-upload-security)
8. [Password Security](#8-password-security)
9. [AI/LLM Security](#9-aillm-security)
10. [Audit Logging](#10-audit-logging)
11. [Legal Compliance (GDPR/CCPA)](#11-legal-compliance-gdprccpa)
12. [Payment Security (Stripe)](#12-payment-security-stripe)
13. [Database Security](#13-database-security)
14. [Security Checklist](#14-security-checklist)

---

## 1. Authentication and Session Management

### 1.1 JWT-Based Sessions

**Location**: `src/lib/auth.ts`

- Uses NextAuth.js with JWT strategy
- Session tokens expire after 24 hours (`maxAge: 24 * 60 * 60`)
- Tokens are refreshed every hour (`updateAge: 60 * 60`)
- Credentials provider with secure password verification

```typescript
session: {
  strategy: "jwt",
  maxAge: 24 * 60 * 60, // 24 hours
  updateAge: 60 * 60,   // Refresh every hour
}
```

### 1.2 Timing Attack Prevention

**Location**: `src/lib/auth.ts`

- Constant-time comparison behavior prevents timing attacks
- Even when user doesn't exist, password hash comparison is simulated to prevent enumeration

```typescript
if (!user || !user.passwordHash) {
  // Simulate password check delay to prevent timing attacks
  await bcrypt.compare(password, "$2a$12$invalid.hash.to.prevent.timing.attacks");
  return null;
}
```

### 1.3 User Enumeration Prevention

**Location**: `src/app/api/auth/signup/route.ts`, `src/app/api/auth/forgot-password/route.ts`

- Generic error messages prevent revealing whether an email exists
- Signup returns "Unable to create account" instead of "Email already exists"
- Password reset always returns success message regardless of email existence

---

## 2. Authorization and Access Control

### 2.1 Route Protection

**Location**: `src/middleware.ts`

- Middleware protects dashboard, projects, and settings routes
- Unauthenticated users redirected to login
- Authenticated users redirected away from auth pages

### 2.2 Resource Ownership Verification

**Location**: `src/app/api/projects/[id]/route.ts`

All API routes verify that the authenticated user owns the requested resource:

```typescript
const project = await prisma.project.findFirst({
  where: {
    id: params.id,
    userId: session.user.id  // Ownership check
  },
});
```

---

## 3. Input Validation and Sanitization

### 3.1 Email Validation

**Location**: `src/app/api/auth/signup/route.ts`

- Maximum length: 255 characters
- Format validation with regex
- Automatic normalization (lowercase, trimmed)

```typescript
const MAX_EMAIL_LENGTH = 255;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### 3.2 Name Validation

- Maximum length: 100 characters
- Trimmed before storage

### 3.3 Project Name Validation

**Location**: `src/app/api/projects/route.ts`

- Maximum length: 255 characters

### 3.4 Requirement Type Validation

**Location**: `src/lib/security.ts`

- Whitelist validation for enum values
- Invalid values default to safe fallback

```typescript
export function sanitizeRequirementType(type: string): string {
  const validTypes = ["PROCEDURAL", "DECLARATIVE", "DESCRIPTIVE", "EVIDENCE_BASED"];
  const upperType = type?.toUpperCase?.() || "";
  return validTypes.includes(upperType) ? upperType : "DECLARATIVE";
}
```

---

## 4. Rate Limiting and Brute Force Protection

### 4.1 Login Rate Limiting

**Location**: `src/lib/auth.ts`

- Maximum 5 attempts per minute per email
- 15-minute lockout after max attempts exceeded
- In-memory rate limiting (production should use Redis)

```typescript
const RATE_LIMIT_WINDOW_MS = 60 * 1000;      // 1 minute
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;  // 15 minutes
```

### 4.2 Signup Rate Limiting

**Location**: `src/app/api/auth/signup/route.ts`

- Maximum 5 attempts per minute per IP address
- Returns 429 Too Many Requests when exceeded

### 4.3 Password Reset Rate Limiting

**Location**: `src/app/api/auth/forgot-password/route.ts`

- Per-email: Maximum 3 requests per hour
- Per-IP: Maximum 10 requests per hour
- Stricter limits than login to prevent abuse

```typescript
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;        // 1 hour
const MAX_RESET_ATTEMPTS_PER_EMAIL = 3;
const MAX_RESET_ATTEMPTS_PER_IP = 10;
```

---

## 5. CSRF Protection

### 5.1 Origin/Referer Verification

**Location**: `src/middleware.ts`

- All state-changing API requests (POST, PUT, DELETE) verify origin header
- Referer header used as fallback
- Origin must match host header
- Webhook endpoints excluded (use signature verification instead)

```typescript
function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  // ... verification logic
}
```

---

## 6. Security Headers

### 6.1 HTTP Security Headers

**Location**: `next.config.ts`

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | DENY | Prevents clickjacking |
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| X-XSS-Protection | 1; mode=block | XSS protection for legacy browsers |
| Referrer-Policy | strict-origin-when-cross-origin | Controls referrer information |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | Enforces HTTPS |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), interest-cohort=() | Disables unused browser features |

### 6.2 Content Security Policy

**Location**: `next.config.ts`

```
default-src 'self'
script-src 'self' 'unsafe-eval' 'unsafe-inline'  (Required by Next.js)
style-src 'self' 'unsafe-inline'                 (Required by Tailwind)
img-src 'self' data: https:
font-src 'self'
connect-src 'self' https://api.openai.com
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
```

---

## 7. File Upload Security

### 7.1 File Type Validation

**Location**: `src/app/api/projects/route.ts`

- Magic bytes validation using `file-type` library
- Not relying solely on file extension
- Allowed MIME types whitelist:
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

```typescript
const detectedType = await fileType.fromBuffer(buffer);
if (!detectedType || !ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
  // Reject file
}
```

### 7.2 File Size Limits

- Maximum file size: 10MB

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

---

## 8. Password Security

### 8.1 Password Hashing

**Location**: `src/app/api/auth/signup/route.ts`, `src/app/api/auth/reset-password/route.ts`

- bcrypt with cost factor 12
- Passwords never stored in plain text

```typescript
const passwordHash = await bcrypt.hash(password, 12);
```

### 8.2 Password Strength Requirements

**Location**: `src/app/api/auth/signup/route.ts`

| Requirement | Validation |
|------------|------------|
| Minimum length | 8 characters |
| Maximum length | 128 characters |
| Uppercase letter | At least one required |
| Lowercase letter | At least one required |
| Number | At least one required |
| Special character | At least one required |

```typescript
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) { /* ... */ }
  if (!/[A-Z]/.test(password)) { /* ... */ }
  if (!/[a-z]/.test(password)) { /* ... */ }
  if (!/[0-9]/.test(password)) { /* ... */ }
  if (!/[^A-Za-z0-9]/.test(password)) { /* ... */ }
  return { valid: true };
}
```

### 8.3 Password Reset Flow

**Location**: `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts`

- Secure token generation: `crypto.randomBytes(32)`
- Token expiration: 1 hour
- Single-use tokens (marked as used after consumption)
- All other tokens for same email invalidated after successful reset
- Transactional update ensures atomic operations

---

## 9. AI/LLM Security

### 9.1 Prompt Injection Prevention

**Location**: `src/lib/security.ts`

The `sanitizeForLLM()` function protects against prompt injection attacks:

1. **Control character removal**: Removes non-printable characters
2. **Instruction marker escaping**: Neutralizes potential prompt injection patterns
3. **Excessive special character limiting**: Prevents exploit attempts
4. **Code block escaping**: Marks code blocks as document content
5. **Context overflow prevention**: Truncates at 200,000 characters

```typescript
const dangerousPatterns = [
  /```system/gi, /```assistant/gi, /```user/gi,
  /<\|im_start\|>/gi, /<\|im_end\|>/gi,
  /\[INST\]/gi, /\[\/INST\]/gi,
  /<<SYS>>/gi, /<\/SYS>>/gi,
  /Human:/gi, /Assistant:/gi, /System:/gi,
  // ... more patterns
];
```

### 9.2 AI Output Quality Guardrails

**Location**: `src/lib/openai.ts`

**Anti-Overclaiming System**:
- Replaces absolute terms with hedged language
- Inserts placeholders for unverified claims
- Prevents legal liability from AI-generated content

**Fluff Removal**:
- 30+ banned filler phrases automatically removed
- Ensures professional, concise output

---

## 10. Audit Logging

### 10.1 Comprehensive Audit Trail

**Location**: `src/lib/audit.ts`, `prisma/schema.prisma`

All significant user actions are logged for compliance and security monitoring:

| Category | Actions Logged |
|----------|---------------|
| Authentication | Login, login failed, logout, signup, password change |
| Password Reset | Request, completion, failure |
| Data Rights | Export requested/completed, delete requested/completed |
| Consent | Granted, revoked |
| Projects | Create, update, delete |
| Requirements | Update, generate draft |
| CCPA | Opt-out, opt-in |
| Billing | Checkout, subscription changes, payments |

### 10.2 Audit Log Data Captured

```typescript
interface AuditLog {
  userId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  details: Json;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: DateTime;
}
```

### 10.3 IP Address Extraction

Supports multiple proxy configurations:
- `x-forwarded-for` header
- `x-real-ip` header
- `cf-connecting-ip` (Cloudflare)

---

## 11. Legal Compliance (GDPR/CCPA)

### 11.1 GDPR Compliance

| Article | Implementation |
|---------|---------------|
| Article 7 | Consent checkboxes on signup with timestamps |
| Article 13-14 | Privacy Policy page with clear data processing info |
| Article 15-17 | Data export API and account deletion |
| Article 20 | Data portability via JSON export |
| Article 30 | Audit logging for processing activities |

### 11.2 CCPA Compliance

**Location**: `src/app/api/user/ccpa-optout/route.ts`, `src/app/api/user/ccpa-status/route.ts`

- "Do Not Sell My Data" option
- Data deletion capability
- Dedicated CCPA information page

### 11.3 Consent Management

**Location**: `src/components/CookieConsent.tsx`, `src/lib/cookies.ts`

- Cookie consent banner with granular controls
- Three categories: Essential (always on), Preferences, Analytics
- Consent logged to database with version tracking
- Re-consent required when policy version changes

### 11.4 Data Export

**Location**: `src/app/api/user/export/route.ts`

Exports all user data in JSON format:
- Profile information
- Projects and requirements
- Consent history
- Audit logs

Excludes sensitive data like password hashes.

### 11.5 Account Deletion

**Location**: `src/app/api/user/delete/route.ts`

- Cascading delete of all related data
- Anonymized audit log entry for the deletion itself
- Email anonymization for statistical purposes

### 11.6 Legal Pages

- Privacy Policy (`/privacy`)
- Terms of Service (`/terms`)
- Cookie Policy (`/cookies`)
- CCPA Information (`/ccpa`)
- Data Processing Agreement (`/dpa`)

---

## 12. Payment Security (Stripe)

### 12.1 Stripe Integration Security

**Location**: `src/lib/stripe.ts`, `src/app/api/billing/webhook/route.ts`

- Stripe secret key used only server-side
- Never exposed to client
- Environment variable configuration

### 12.2 Webhook Signature Verification

All Stripe webhook events are verified using cryptographic signatures:

```typescript
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
```

### 12.3 Idempotent Event Processing

- Duplicate webhook events are detected and skipped
- Event IDs tracked to prevent double-processing

### 12.4 Customer Data Protection

- Customer IDs tied to authenticated users only
- User ID stored in Stripe customer metadata for verification

---

## 13. Database Security

### 13.1 Row-Level Security (RLS)

**Location**: `prisma/migrations/20260116_enable_rls/migration.sql`, `src/lib/prisma.ts`

PostgreSQL Row-Level Security provides **defense-in-depth** user isolation at the database layer. Even if application code has bugs, the database will prevent cross-user data access.

**Tables Protected by RLS**:

| Table | Isolation Method |
|-------|-----------------|
| Project | Direct userId match |
| Requirement | Via Project.userId (subquery) |
| RequirementVersion | Via Requirement → Project.userId |
| ProjectExport | Via Project.userId (subquery) |
| PastResponse | Direct userId match |
| ConsentLog | Direct userId match |
| DataExportRequest | Direct userId match |
| SingleUsePurchase | Direct userId match |
| AuditLog | Users read own logs only; service writes all |

**How It Works**:

1. **User Context**: API routes set `app.current_user_id` session variable after authentication:
```typescript
await setRLSContext(session.user.id);
```

2. **Policy Check**: PostgreSQL policies check `current_user_id()` function:
```sql
CREATE POLICY project_isolation_policy ON "Project"
  USING ("userId" = current_user_id())
  WITH CHECK ("userId" = current_user_id());
```

3. **Service Bypass**: When `current_user_id()` is NULL (cron jobs, migrations), policies allow access.

**RLS Helper Functions** (`src/lib/prisma.ts`):

```typescript
// Set user context for RLS
await setRLSContext(userId);

// Clear context (for cleanup)
await clearRLSContext();

// Execute with automatic context management
const result = await withRLSContext(userId, async () => {
  return prisma.project.findMany();
});
```

### 13.2 Prisma ORM

- Parameterized queries prevent SQL injection
- Type-safe database operations
- No raw SQL queries in application code

### 13.3 Cascade Deletion

All user-related data properly cascades on deletion:
- Projects
- Requirements
- Past responses
- Consent logs
- Audit logs
- Sessions

### 13.4 Soft Delete Support

User model includes `deletedAt` field for soft delete option when needed.

### 13.5 Sensitive Data Handling

- Password hashes excluded from data exports
- Email anonymization in deletion audit logs
- 2FA secrets encrypted with AES-256-GCM

---

## 14. Security Checklist

### Implemented

- [x] Rate limiting on authentication endpoints
- [x] Rate limiting on signup endpoint
- [x] Rate limiting on password reset
- [x] Input sanitization for LLM prompts
- [x] File upload validation with magic bytes
- [x] CSRF protection via origin/referer verification
- [x] Password strength validation
- [x] User enumeration prevention
- [x] Session maxAge configuration
- [x] Security headers (CSP, HSTS, X-Frame-Options, etc.)
- [x] Bcrypt password hashing (cost factor 12)
- [x] Timing attack prevention
- [x] Audit logging for compliance
- [x] GDPR data export
- [x] GDPR account deletion
- [x] CCPA opt-out support
- [x] Cookie consent management
- [x] Stripe webhook signature verification
- [x] Resource ownership verification
- [x] Row-Level Security (RLS) for database-level isolation
- [x] Authenticated encryption (AES-256-GCM) for 2FA secrets

### Recommended Improvements

- [ ] Redis-based rate limiting for distributed deployments
- [ ] Email verification for new accounts
- [x] Two-factor authentication (2FA) - Implemented with TOTP
- [ ] Security event alerting
- [ ] Penetration testing
- [ ] Regular dependency vulnerability scanning
- [ ] Database encryption at rest
- [ ] Secrets management (e.g., HashiCorp Vault)
- [x] Row-Level Security (RLS) for database-level user isolation

---

## File Reference

| Security Feature | Primary Files |
|-----------------|---------------|
| Authentication | `src/lib/auth.ts` |
| Rate Limiting | `src/lib/auth.ts`, `src/app/api/auth/signup/route.ts`, `src/app/api/auth/forgot-password/route.ts` |
| CSRF Protection | `src/middleware.ts` |
| Security Headers | `next.config.ts` |
| Input Sanitization | `src/lib/security.ts` |
| File Validation | `src/app/api/projects/route.ts` |
| Audit Logging | `src/lib/audit.ts` |
| Cookie Consent | `src/lib/cookies.ts`, `src/components/CookieConsent.tsx` |
| Data Export | `src/app/api/user/export/route.ts` |
| Account Deletion | `src/app/api/user/delete/route.ts` |
| Stripe Security | `src/lib/stripe.ts`, `src/app/api/billing/webhook/route.ts` |
| Password Reset | `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts` |
| Row-Level Security | `prisma/migrations/20260116_enable_rls/migration.sql`, `src/lib/prisma.ts`, `src/lib/api-auth.ts` |
| Encryption (2FA) | `src/lib/crypto.ts` |

---

*Last Updated: January 2026*
