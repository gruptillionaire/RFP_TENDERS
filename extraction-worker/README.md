# RFP Extraction Worker

The long-running document extraction service used by RFP Matrix. It runs outside the web application's serverless request lifecycle so large tender packs can be processed without holding open a browser or Vercel function request.

See the [repository README](../README.md) for product and system context.

## Request Flow

1. The web application creates an extraction job.
2. It sends document text, a job ID, and an approved callback URL to `POST /extract-async`.
3. The worker returns immediately, performs extraction, and calls the authenticated webhook with the result.
4. The application stores the extracted requirements and exposes job status to the browser.

Worker requests use `X-Worker-Key`. Asynchronous callback URLs are checked against `ALLOWED_WEBHOOK_HOSTS` before any outbound request is made.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Gemini extraction requests |
| `EXTRACTION_WORKER_KEY` | Production | Shared secret for requests and callbacks |
| `ALLOWED_ORIGINS` | Production | Comma-separated browser origins |
| `ALLOWED_WEBHOOK_HOSTS` | Production | Comma-separated callback host allowlist |
| `PORT` | No | HTTP port, default `3001` |
| `NODE_ENV` | No | Runtime environment |

Copy `.env.example` to `.env` for local development.

## Commands

```bash
npm ci
npm run dev
npm run typecheck
npm run build
npm start
```

## Endpoints

### `GET /health`

Returns service status, timestamp, and version.

### `POST /extract-async`

Starts an asynchronous extraction and returns immediately.

Headers:

```http
Content-Type: application/json
X-Worker-Key: <shared secret>
```

Body:

```json
{
  "documentText": "Full tender text...",
  "jobId": "job-id",
  "webhookUrl": "https://approved-host.example/api/extract/webhook",
  "model": "gemini-2.5-flash"
}
```

Accepted response:

```json
{
  "accepted": true,
  "jobId": "job-id"
}
```

The webhook receives `status: "complete"` with `result`, or `status: "failed"` with an error description.

### `POST /extract`

Synchronous extraction endpoint used for direct diagnostics. It accepts `documentText` and an optional Gemini `model`, then waits for the extraction result.

## Deployment

The worker is deployed to Fly.io from `.github/workflows/fly-deploy.yml` when files under `extraction-worker/` change on `main`. Production configuration belongs in Fly secrets, not committed environment files.
