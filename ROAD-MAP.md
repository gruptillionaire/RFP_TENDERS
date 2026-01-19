# RFP Matrix - Feature Roadmap

Issues and enhancements identified during MVP audit that are **not** being addressed in the initial critical fixes release.

---

## High Priority (Post-MVP Launch)

### Individual Requirement Deletion
- **Issue**: Users cannot remove mistakenly extracted requirements
- **Impact**: Poor UX when extraction produces incorrect results
- **Effort**: Small - Add DELETE endpoint and UI button

### User Onboarding Flow
- **Issue**: New users dropped into dashboard with no guidance
- **Impact**: Higher churn, support burden
- **Effort**: Medium - Create guided first-project wizard

### Optimistic UI Rollback
- **Location**: `ProjectView.tsx` lines 229-241
- **Issue**: Status updates don't rollback on API failure
- **Impact**: UI/server state desynchronization
- **Effort**: Small - Add try/catch with state restoration

### Request Timeout for Sync Worker Calls
- **Location**: `extractViaWorker()` in openai.ts
- **Issue**: Sync extraction path has 5-minute timeout but no AbortController on initial fetch
- **Impact**: Hung requests on worker unavailability
- **Effort**: Small - Add AbortController to fetch calls

---

## Medium Priority (Month 1)

### Virtual Scrolling for Large Lists
- **Issue**: 100+ requirements causes performance degradation
- **Impact**: Sluggish UI on large RFPs
- **Effort**: Medium - Integrate react-window or similar

### Full-Text Search
- **Issue**: No search within project requirements
- **Impact**: Hard to find specific requirements in large documents
- **Effort**: Medium - Add search index and UI

### API Documentation
- **Issue**: No OpenAPI/Swagger documentation
- **Impact**: Blocks enterprise integrations
- **Effort**: Medium - Generate from route definitions

### Structured Logging
- **Location**: Throughout codebase
- **Issue**: Console.log statements in production
- **Impact**: Log noise, potential info leakage
- **Effort**: Medium - Integrate Pino or Winston, add log levels

### React Error Boundaries
- **Location**: Dashboard components
- **Issue**: Unhandled JS errors crash entire component tree
- **Impact**: Poor error recovery UX
- **Effort**: Small - Wrap key components in error boundaries

---

## Low Priority (Month 2+)

### CSRF Token Enhancement
- **Location**: `middleware.ts` lines 15-29
- **Issue**: Allows requests without Origin/Referer headers
- **Impact**: Minor CSRF bypass vector
- **Effort**: Small - Require headers or implement token-based CSRF

### Evaluation Criteria Weight Validation
- **Location**: `/api/projects/[id]/route.ts` lines 81-86
- **Issue**: Individual weights not validated for range (0-100)
- **Impact**: Calculation errors possible
- **Effort**: Small - Add per-weight validation

### ReDoS Pattern Review
- **Location**: `extraction-worker/src/extract.ts`
- **Issue**: Complex regex patterns could be slow on adversarial input
- **Impact**: DoS risk on malicious documents
- **Effort**: Medium - Audit and optimize patterns

### Timing-Safe Compare Fix
- **Location**: `extraction-worker/src/index.ts` lines 26-33
- **Issue**: Length mismatch comparison is not truly constant-time
- **Impact**: Minimal - theoretical timing leak
- **Effort**: Small - Use fixed-length dummy comparison

### Background Task Await
- **Location**: `/api/billing/webhook/route.ts` line 102
- **Issue**: Cleanup runs without await, errors not logged
- **Impact**: Silent failures, cold start variability
- **Effort**: Small - Wrap in try/catch or use proper job queue

### JSON Storage Sanitization
- **Location**: `/api/extract/webhook/route.ts` line 142
- **Issue**: Extraction result stored without structure validation
- **Impact**: Malicious JSON if worker compromised
- **Effort**: Small - Add Zod validation on result shape

### Version Number Centralization
- **Issue**: Hardcoded versions scattered ("1.0.0", "2.0.0", "v9")
- **Impact**: Version drift
- **Effort**: Small - Single source in package.json

---

## Documentation Gaps

| Document | Priority | Description |
|----------|----------|-------------|
| User Guide | High | End-user documentation for features |
| API Reference | Medium | OpenAPI spec for integrations |
| Deployment Guide | Medium | Production deployment walkthrough |
| Contributing Guide | Low | For open-source contributors |

---

## UX Enhancements

| Feature | Priority | Description |
|---------|----------|-------------|
| Progress Percentage | Medium | Show extraction % complete instead of just spinner |
| Keyboard Shortcuts | Low | Power user navigation (j/k, Enter, etc.) |
| Bulk Actions | Medium | Select multiple requirements for status change |
| Dark Mode | Low | Theme toggle for accessibility |
| Mobile Responsiveness | Medium | Dashboard usability on tablets |

---

## Infrastructure

| Item | Priority | Description |
|------|----------|-------------|
| Staging Environment | High | Separate env for testing before prod |
| Health Check Endpoint | Medium | `/api/health` for monitoring |
| Uptime Monitoring | Medium | External ping service integration |
| Database Backups | High | Automated Neon backup schedule |
| Error Budget Tracking | Low | SLO/SLI dashboards |

---

## Scaling Considerations

| Item | When Needed | Description |
|------|-------------|-------------|
| Database Read Replicas | 1000+ users | Offload read queries |
| CDN for Static Assets | 100+ concurrent | Vercel Edge caching |
| Worker Auto-scaling | Heavy load | Fly.io machine scaling |
| Queue System | Complex workflows | BullMQ or similar for job processing |
| Caching Layer | High traffic | Redis cache for frequent queries |

---

*Last updated: January 2026*
*Generated from QA audit and product completeness assessment*
