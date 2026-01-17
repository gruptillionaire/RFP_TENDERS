# RFP Extraction Worker

External worker service for RFP requirement extraction. Runs outside Vercel's time limits to handle large documents with full LLM extraction.

## Why External Worker?

Vercel serverless functions have time limits (10-60s depending on plan). Large RFP documents with 400+ requirements can take 2-5 minutes to process with LLM extraction. This worker runs on Railway/Fly.io with no time limits.

## Cost Estimates

| Document Size | Requirements | GPT-4o-mini | GPT-4o |
|---------------|--------------|-------------|--------|
| Small (20K chars) | ~50 | $0.01 | $0.15 |
| Medium (50K chars) | ~150 | $0.02 | $0.35 |
| Large (100K chars) | ~300 | $0.03 | $0.60 |
| Huge (150K+ chars) | ~400+ | $0.04 | $0.85 |

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file:

```env
# Required
OPENAI_API_KEY=sk-...

# Optional - for securing the endpoint
EXTRACTION_WORKER_KEY=your-secret-key

# Optional - CORS origins (comma-separated)
ALLOWED_ORIGINS=https://your-app.vercel.app

# Optional - port (default: 3001)
PORT=3001
```

### 3. Run Locally

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

### 4. Test the Endpoint

```bash
curl -X POST http://localhost:3001/extract \
  -H "Content-Type: application/json" \
  -H "X-Worker-Key: your-secret-key" \
  -d '{"documentText": "1. Describe your approach to security.", "model": "gpt-4o-mini"}'
```

## Deploy to Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repo
3. Set environment variables:
   - `OPENAI_API_KEY`
   - `EXTRACTION_WORKER_KEY`
4. Deploy

Railway will auto-detect the Dockerfile and deploy.

## Deploy to Fly.io

1. Install Fly CLI: `brew install flyctl`
2. Login: `fly auth login`
3. Create app: `fly launch`
4. Set secrets:
   ```bash
   fly secrets set OPENAI_API_KEY=sk-...
   fly secrets set EXTRACTION_WORKER_KEY=your-secret-key
   ```
5. Deploy: `fly deploy`

## API Endpoints

### POST /extract

Extract requirements from document text.

**Request:**
```json
{
  "documentText": "Full RFP document text...",
  "model": "gpt-4o-mini"  // Optional, default: gpt-4o-mini
}
```

**Headers:**
- `Content-Type: application/json`
- `X-Worker-Key: your-secret-key` (if configured)

**Response:**
```json
{
  "deadline": "2025-02-14T17:00:00",
  "deadlineText": "5pm Friday 14 February 2025",
  "requirements": [
    {
      "section": "3.1.1",
      "sectionGroup": "3: Technical Requirements",
      "text": "Describe your approach to security.",
      "type": "DESCRIPTIVE",
      "isMandatory": true,
      "domainContext": "LEGAL",
      "wordLimit": null,
      "characterLimit": null,
      "isAttestation": false
    }
  ]
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-17T12:00:00.000Z",
  "version": "1.0.0"
}
```

## Configure Main App

In your Vercel app, set these environment variables:

```env
# Worker URL (Railway/Fly.io URL)
EXTRACTION_WORKER_URL=https://your-worker.railway.app

# Worker auth key (must match worker's EXTRACTION_WORKER_KEY)
EXTRACTION_WORKER_KEY=your-secret-key
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel App    │────▶│  This Worker    │────▶│    OpenAI API   │
│  (time limited) │     │ (no time limit) │     │ (GPT-4o-mini)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │   POST /extract       │   Full EXTRACTION_PROMPT
        │   { documentText }    │   + document text
        │                       │
        ▼                       ▼
   Returns quickly        Takes 1-5 minutes
   (async polling)        for large documents
```
