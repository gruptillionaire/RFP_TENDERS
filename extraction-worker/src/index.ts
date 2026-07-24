import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import crypto from 'crypto';
import { extractRequirements } from './extract';

const app = express();
const PORT = process.env.PORT || 3001;
const WORKER_KEY = process.env.EXTRACTION_WORKER_KEY || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Allowed webhook URL patterns (SSRF prevention)
// Default allows localhost, Vercel deployments, and production domain
const ALLOWED_WEBHOOK_HOSTS = (process.env.ALLOWED_WEBHOOK_HOSTS || 'localhost,vercel.app,rfpmatrix.com').split(',');

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
}));
app.use(express.json({ limit: '50mb' })); // Large documents

// Timing-safe string comparison to prevent timing attacks
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still compare to avoid timing leak on length
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Validate webhook URL to prevent SSRF attacks
function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return ALLOWED_WEBHOOK_HOSTS.some(allowed =>
      host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

// Auth middleware
function validateWorkerKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!WORKER_KEY) {
    if (IS_PRODUCTION) {
      console.error('[Auth] CRITICAL: No worker key configured in production!');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }
    // Dev mode only - allow without key
    return next();
  }

  const providedKey = req.headers['x-worker-key'];
  if (typeof providedKey !== 'string' || !timingSafeCompare(providedKey, WORKER_KEY)) {
    return res.status(401).json({ error: 'Invalid worker key' });
  }

  next();
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Helper: Retry webhook with exponential backoff
async function callWebhookWithRetry(
  webhookUrl: string,
  payload: object,
  jobId: string,
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Initial delay to ensure DB has committed the job record
      if (attempt === 1) {
        await new Promise(r => setTimeout(r, 500));
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Worker-Key': WORKER_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`[Webhook] Job ${jobId}: Success on attempt ${attempt}`);
        return true;
      }

      // 404 might mean job not yet committed - retry
      if (response.status === 404 && attempt < maxRetries) {
        console.warn(`[Webhook] Job ${jobId}: Got 404, retrying in ${attempt * 1000}ms...`);
        await new Promise(r => setTimeout(r, attempt * 1000));
        continue;
      }

      console.error(`[Webhook] Job ${jobId}: Failed with status ${response.status}`);
      return false;
    } catch (error) {
      console.error(`[Webhook] Job ${jobId}: Attempt ${attempt} failed:`, error);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }
  return false;
}

// Async extraction endpoint (returns immediately, calls webhook when done)
app.post('/extract-async', validateWorkerKey, async (req, res) => {
  const { documentText, jobId, webhookUrl, model } = req.body;

  if (!documentText || typeof documentText !== 'string') {
    return res.status(400).json({ error: 'documentText is required' });
  }

  if (!jobId || !webhookUrl) {
    return res.status(400).json({ error: 'jobId and webhookUrl are required' });
  }

  // SSRF prevention: validate webhook URL
  if (!isAllowedWebhookUrl(webhookUrl)) {
    console.error(`[/extract-async] Job ${jobId}: Rejected invalid webhook URL`);
    return res.status(400).json({ error: 'Invalid webhook URL' });
  }

  console.log(`[/extract-async] Job ${jobId}: Starting async extraction of ${documentText.length} chars`);

  // Return immediately
  res.json({ accepted: true, jobId });

  // Process in background
  const startTime = Date.now();

  try {
    const result = await extractRequirements(documentText, { model });
    const elapsed = Date.now() - startTime;

    console.log(`[/extract-async] Job ${jobId}: Complete with ${result.requirements.length} requirements in ${elapsed}ms`);

    // Call webhook with retry
    await callWebhookWithRetry(webhookUrl, {
      jobId,
      status: 'complete',
      result,
      elapsed,
    }, jobId);
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[/extract-async] Job ${jobId}: Failed after ${elapsed}ms:`, message);

    // Call webhook with error (with retry)
    await callWebhookWithRetry(webhookUrl, {
      jobId,
      status: 'failed',
      error: message,
      elapsed,
    }, jobId);
  }
});

// Sync extraction endpoint (original - waits for completion)
app.post('/extract', validateWorkerKey, async (req, res) => {
  const startTime = Date.now();
  const { documentText, model } = req.body;

  if (!documentText || typeof documentText !== 'string') {
    return res.status(400).json({ error: 'documentText is required' });
  }

  console.log(`[/extract] Starting extraction of ${documentText.length} chars with model ${model || 'default'}`);

  try {
    const result = await extractRequirements(documentText, { model });
    const elapsed = Date.now() - startTime;

    console.log(`[/extract] Complete: ${result.requirements.length} requirements in ${elapsed}ms`);

    res.json(result);
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[/extract] Error after ${elapsed}ms:`, message);

    res.status(500).json({
      error: 'Extraction failed',
      message,
      elapsed,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           RFP Extraction Worker Service                    ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${String(PORT).padEnd(50)}║
║  Auth: ${WORKER_KEY ? 'Enabled'.padEnd(50) : 'Disabled (dev mode)'.padEnd(50)}║
║  Ready to process extraction requests                      ║
╚════════════════════════════════════════════════════════════╝
  `);
});
