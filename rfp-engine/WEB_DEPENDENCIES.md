# Web Dependencies

External services and platforms that power RFP Matrix.

---

## Hosting & Infrastructure

### Vercel
- **Purpose:** Hosting, serverless functions, cron jobs, domain management
- **URL:** [vercel.com](https://vercel.com)
- **Dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard)
- **Used for:**
  - Next.js app hosting
  - Serverless API routes
  - Cron jobs (deadline reminders, cleanup)
  - Domain: rfpmatrix.com
- **Env vars:** `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`

---

### PostgreSQL Database (Vercel Postgres / Neon)
- **Purpose:** Primary database
- **Dashboard:** Check your Vercel project → Storage
- **Used for:**
  - User accounts
  - Projects and requirements
  - Subscriptions and billing data
  - Audit logs
- **Env vars:** `DATABASE_URL`

---

## Payments

### Stripe
- **Purpose:** Subscriptions and one-time payments
- **URL:** [stripe.com](https://stripe.com)
- **Dashboard:** [dashboard.stripe.com](https://dashboard.stripe.com)
- **Used for:**
  - Monthly subscriptions (Starter, Pro, Team, Business)
  - One-time Single RFP purchases
  - Customer billing portal
  - Webhook events (subscription changes)
- **Env vars:**
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_STARTER_PRICE_ID`
  - `STRIPE_PRO_PRICE_ID`
  - `STRIPE_TEAM_PRICE_ID`
  - `STRIPE_BUSINESS_PRICE_ID`
  - `STRIPE_SINGLE_USE_PRICE_ID`

---

## Email

### Resend
- **Purpose:** Transactional emails (automated, from app)
- **URL:** [resend.com](https://resend.com)
- **Dashboard:** [resend.com/emails](https://resend.com/emails)
- **Used for:**
  - Password reset emails
  - Deadline reminder emails
  - (Future) Welcome emails, notifications
- **Sends from:** `noreply@rfpmatrix.com`
- **Env vars:**
  - `RESEND_API_KEY`
  - `FROM_EMAIL`

---

### Zoho Mail
- **Purpose:** Customer support inbox (human emails)
- **URL:** [zoho.com/mail](https://www.zoho.com/mail/)
- **Dashboard:** [mail.zoho.com](https://mail.zoho.com)
- **Used for:**
  - Receiving customer emails at `help@rfpmatrix.com`
  - Manually replying to customer inquiries
- **Plan:** Free (up to 5 users)

---

## AI / Machine Learning

### OpenAI
- **Purpose:** AI-powered extraction and drafting
- **URL:** [openai.com](https://openai.com)
- **Dashboard:** [platform.openai.com](https://platform.openai.com)
- **Used for:**
  - RFP requirement extraction (GPT-4o-mini)
  - Draft response generation (GPT-3.5-turbo)
- **Env vars:** `OPENAI_API_KEY`

---

## Authentication

### NextAuth.js (Credentials)
- **Purpose:** Email/password authentication
- **Type:** Self-hosted (no external service)
- **Used for:**
  - User signup with email/password
  - Login with email/password
  - Password reset flow
  - Session management (JWT)
- **Features:**
  - Rate limiting (5 attempts, 15-min lockout)
  - "Remember me" (30-day sessions)
  - 2FA support (TOTP)
- **Env vars:**
  - `NEXTAUTH_URL`
  - `NEXTAUTH_SECRET`

---

## DNS Records Summary

For `rfpmatrix.com` (managed in Vercel):

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| MX | @ | mx.zoho.com (priority 10) | Zoho Mail receiving |
| MX | @ | mx2.zoho.com (priority 20) | Zoho Mail backup |
| TXT | @ | v=spf1 include:resend.com include:zoho.com ~all | Email authentication |
| TXT | resend._domainkey | (from Resend) | Resend DKIM |
| TXT | zmail._domainkey | (from Zoho) | Zoho DKIM |
| CNAME | www | cname.vercel-dns.com | Vercel hosting |

---

## Environment Variables Checklist

```bash
# Database
DATABASE_URL=

# Auth
NEXTAUTH_URL=https://rfpmatrix.com
NEXTAUTH_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_PRO_PRICE_ID=
STRIPE_TEAM_PRICE_ID=
STRIPE_BUSINESS_PRICE_ID=
STRIPE_SINGLE_USE_PRICE_ID=

# Email
RESEND_API_KEY=
FROM_EMAIL=noreply@rfpmatrix.com

# AI
OPENAI_API_KEY=
```

---

## Cost Overview

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Pro | ~$20/month |
| Database | Vercel Postgres | Usage-based |
| Stripe | Standard | 2.9% + 30¢ per transaction |
| Resend | Free tier | Free (3,000 emails/month) |
| Zoho Mail | Free | Free (5 users) |
| OpenAI | Pay-as-you-go | ~$0.01-0.03 per extraction |
