# RFP Matrix Web Application

The customer-facing application and API for RFP Matrix. Product context and the complete architecture are documented in the [repository README](../README.md).

## Responsibilities

- Authentication, account security, and subscriptions
- Tender upload and document parsing
- Extraction job orchestration
- Compliance matrix state and requirement versioning
- AI-assisted drafting and response-library workflows
- DOCX and PDF export
- Operational APIs, scheduled cleanup, and deadline reminders

## Commands

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test:integration
npm run build
```

Copy `.env.example` to `.env.local` and provide the services required for the features being tested. A local PostgreSQL database and `NEXTAUTH_SECRET` are required for the normal authenticated application flow.

## Main Dependencies

- Next.js and React
- Prisma and PostgreSQL
- Auth.js
- Stripe
- Upstash Redis
- Resend
- Sentry
