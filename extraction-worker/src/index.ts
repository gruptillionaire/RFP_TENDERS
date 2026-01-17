import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { extractRequirements } from './extract';

const app = express();
const PORT = process.env.PORT || 3001;
const WORKER_KEY = process.env.EXTRACTION_WORKER_KEY || '';

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
}));
app.use(express.json({ limit: '50mb' })); // Large documents

// Auth middleware
function validateWorkerKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!WORKER_KEY) {
    // No key configured = allow all (dev mode)
    return next();
  }

  const providedKey = req.headers['x-worker-key'];
  if (providedKey !== WORKER_KEY) {
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

// Main extraction endpoint
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
