# RFP Engine - Outstanding Issues

This document tracks issues identified during MVP audits that are not yet resolved.

---

## High Priority

### 1. Add Requirement Delete Endpoint
**File:** `src/app/api/requirements/[id]/route.ts`
**Issue:** No endpoint exists to delete individual requirements
**Impact:** Users cannot remove mistakenly extracted requirements
**Fix:** Add DELETE handler to requirements API route

### 2. Add Abort Controllers to Fetch Calls
**Files:** Various client components
**Issue:** Long-running fetch requests aren't cancelled on component unmount
**Impact:** Potential memory leaks, stale state updates
**Fix:** Add AbortController to useEffect cleanup in components making fetch calls
**Note:** Partially implemented in `ProjectView.tsx` - need to audit other components

---

## Medium Priority

### 3. Rate Limiting in Serverless Environment
**File:** `src/lib/rate-limit.ts`
**Issue:** Rate limiting uses in-memory Maps, which don't persist across serverless function invocations
**Impact:** Rate limits may not be effective in serverless deployments (each cold start gets fresh memory)
**Fix:** Use Redis/Upstash for rate limiting state, or implement at edge (Vercel Edge Config)
**Note:** Current implementation works for single-server deployments but not for serverless at scale

### 4. Add Request ID Correlation
**Issue:** No request IDs for tracing errors across services
**Impact:** Difficult to debug production issues
**Fix:** Generate request ID in middleware, pass through to logging

---

## Low Priority

### 5. Virtual Scrolling for Large Requirement Lists
**File:** `src/app/(dashboard)/projects/[id]/ProjectClient.tsx`
**Issue:** All requirements rendered at once
**Impact:** Performance degradation with 100+ requirements
**Fix:** Implement virtualized list (react-window or similar)

### 6. Database Query Optimization
**File:** `src/app/api/projects/route.ts`
**Issue:** Dashboard queries could be optimized with selective fields
**Impact:** Minor performance improvement
**Fix:** Use `select` to limit returned fields in project list queries

### 7. Add Health Check Endpoint
**File:** `src/app/api/health/route.ts` (new)
**Issue:** No endpoint for monitoring/load balancer health checks
**Impact:** Can't easily verify service health
**Fix:** Add simple health check endpoint returning 200 OK

---

## Completed

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
