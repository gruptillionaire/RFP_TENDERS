# RFP Engine - Outstanding Issues

This document tracks issues identified during MVP audits that are not yet resolved.

---

## High Priority

### 1. Add Abort Controllers to Fetch Calls
**Files:** Various client components
**Issue:** Long-running fetch requests aren't cancelled on component unmount
**Impact:** Potential memory leaks, stale state updates
**Fix:** Add AbortController to useEffect cleanup in components making fetch calls
**Note:** Partially implemented in `ProjectView.tsx` - need to audit other components

---

## Medium Priority

### 2. Add Request ID Correlation
**Issue:** No request IDs for tracing errors across services
**Impact:** Difficult to debug production issues
**Fix:** Generate request ID in middleware, pass through to logging

---

## Low Priority

### 3. Virtual Scrolling for Large Requirement Lists
**File:** `src/app/(dashboard)/projects/[id]/ProjectClient.tsx`
**Issue:** All requirements rendered at once
**Impact:** Performance degradation with 100+ requirements
**Fix:** Implement virtualized list (react-window or similar)

---

## Completed

- [x] Add requirement delete endpoint (`/api/requirements/[id]` DELETE - with ownership verification and audit logging)
- [x] Add health check endpoint (`/api/health` - checks DB and Redis)
- [x] Add Redis rate limiting (Upstash)
- [x] Optimize dashboard queries (combined user data fetch)
- [x] Fix hardcoded encryption keys (created centralized crypto module)
- [x] Fix quota race condition (wrapped in Prisma transaction)
- [x] Persist 2FA sessions to database (added Pending2FASession model)
- [x] Fix webhook idempotency (added ProcessedWebhookEvent model)
- [x] Add client-side file validation (type + size checks)
- [x] Fix N+1 query in project PATCH (batched updates with transaction)
- [x] Hide PDF export option (already marked as "Coming Soon" with disabled state)
- [x] Add server-side file validation (magic bytes, size limits in projects route)
- [x] Add Content Security Policy headers (full CSP in next.config.ts)
- [x] Add input debouncing for search/filter (ProjectView, LibraryClient, InsertFromLibraryModal)
- [x] Implement PDF export (pdf-generator.ts using pdf-lib)
- [x] Add failed payment email notification (webhook sends email on invoice.payment_failed)

---

## Notes

- Before deploying, run `npx prisma generate` and `npx prisma db push` to sync schema changes
- Set `TOTP_ENCRYPTION_KEY` environment variable in production
- Set `ADMIN_EMAILS` environment variable for admin access
- Consider adding monitoring/alerting for webhook failures
