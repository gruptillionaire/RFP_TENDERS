# RFP Engine - Outstanding Issues

This document tracks issues identified during MVP audits that are not yet resolved.

---

## High Priority

### 1. Add Requirement Delete Endpoint
**File:** `src/app/api/requirements/[id]/route.ts`
**Issue:** No endpoint exists to delete individual requirements
**Impact:** Users cannot remove mistakenly extracted requirements
**Fix:** Add DELETE handler to requirements API route

### 2. Add Failed Payment Email Notification
**File:** `src/app/api/billing/webhook/route.ts:339-381`
**Issue:** Payment failure handler updates status but doesn't notify user
**Impact:** Users may not know their payment failed until service is interrupted
**Fix:** Integrate email service (Resend/SendGrid) to notify users of payment failures

### 3. Add Abort Controllers to Fetch Calls
**Files:** Various client components
**Issue:** Long-running fetch requests aren't cancelled on component unmount
**Impact:** Potential memory leaks, stale state updates
**Fix:** Add AbortController to useEffect cleanup in components making fetch calls

---

## Medium Priority

### 4. Rate Limiting in Serverless Environment
**Files:**
- `src/app/api/auth/pre-login/route.ts` (lines 22-55)
- `src/app/api/auth/2fa/challenge/route.ts` (lines 19-43)

**Issue:** Login and 2FA rate limiting uses in-memory Maps, which don't persist across serverless function invocations
**Impact:** Rate limits may not be effective in serverless deployments
**Fix:** Use Redis/Upstash for rate limiting state, or implement at edge (Vercel Edge Config)

### 5. Add Server-Side File Validation
**File:** `src/app/api/projects/route.ts`
**Issue:** Client-side validation added but server should also validate file uploads
**Impact:** Malicious clients could bypass client-side checks
**Fix:** Add file type/size validation in the upload API route

### 6. Content Security Policy Headers
**File:** `next.config.js` or middleware
**Issue:** No CSP headers configured
**Impact:** Potential XSS attack surface
**Fix:** Add strict CSP headers via Next.js config or middleware

### 7. Add Request ID Correlation
**Issue:** No request IDs for tracing errors across services
**Impact:** Difficult to debug production issues
**Fix:** Generate request ID in middleware, pass through to logging

---

## Low Priority

### 8. Virtual Scrolling for Large Requirement Lists
**File:** `src/app/(dashboard)/projects/[id]/ProjectClient.tsx`
**Issue:** All requirements rendered at once
**Impact:** Performance degradation with 100+ requirements
**Fix:** Implement virtualized list (react-window or similar)

### 9. Add Input Debouncing for Search/Filter
**Files:** Library search, requirement filtering
**Issue:** Search triggers on every keystroke
**Impact:** Unnecessary API calls/re-renders
**Fix:** Add 300ms debounce to search inputs

### 10. Database Query Optimization
**File:** `src/app/api/projects/route.ts`
**Issue:** Dashboard queries could be optimized with selective fields
**Impact:** Minor performance improvement
**Fix:** Use `select` to limit returned fields in project list queries

### 11. Add Health Check Endpoint
**File:** `src/app/api/health/route.ts` (new)
**Issue:** No endpoint for monitoring/load balancer health checks
**Impact:** Can't easily verify service health
**Fix:** Add simple health check endpoint returning 200 OK

### 12. Implement PDF Export
**Files:** Export API and document generation
**Issue:** PDF export marked as "Coming Soon"
**Impact:** Users can only export to Word format
**Fix:** Add PDF generation using puppeteer or pdf-lib

---

## Completed (This Session)

- [x] Fix hardcoded encryption keys (created centralized crypto module)
- [x] Fix quota race condition (wrapped in Prisma transaction)
- [x] Persist 2FA sessions to database (added Pending2FASession model)
- [x] Fix webhook idempotency (added ProcessedWebhookEvent model)
- [x] Add client-side file validation (type + size checks)
- [x] Fix N+1 query in project PATCH (batched updates with transaction)
- [x] Hide PDF export option (already marked as "Coming Soon" with disabled state)

---

## Notes

- Before deploying, run `npx prisma generate` and `npx prisma db push` to sync schema changes
- Set `TOTP_ENCRYPTION_KEY` environment variable in production
- Consider adding monitoring/alerting for webhook failures
