import express from 'express';
import cors from 'cors';
import { env } from './config/env.ts';
import { agentRouter } from './routes/agent.ts';
import { memoryRouter } from './routes/memory.ts';
import { sealRouter } from './routes/seal.ts';
import { marketplaceRouter } from './routes/marketplace.ts';
import { startAgentLoop } from './agents/runtime.ts';
import { requireX402Payment } from './x402/middleware.ts';
import { initDB } from './db/sqlite.ts';
import { syncListingsFromChain } from './marketplace/discovery.ts';

const app = express();

app.use(cors({ origin: '*' })); // Allow all origins for demo/testing
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Mount API routes
app.use('/api/agent', agentRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/seal', sealRouter);
app.use('/api/marketplace', marketplaceRouter);

// Example protected route demonstrating x402 integration with flat pricing
app.get('/api/protected/data', requireX402Payment(5000000), (req, res) => {
  res.json({ data: 'Proprietary market alpha data' });
});

// 404 Catch-all to help debug missing routes
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl} - Headers:`, req.headers);
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── Bootstrap ───────────────────────────────────────────────
async function bootstrap() {
  // 1. Initialize database (creates tables if missing)
  await initDB();

  // 2. Sync listings from on-chain events (non-blocking)
  syncListingsFromChain().catch(err =>
    console.warn('[startup] Chain sync failed (non-fatal):', err.message || err)
  );

  // 3. Optionally auto-start the agent loop (disabled - requires ownerAddress per agent)
  if (env.AUTO_START) {
    console.log('[startup] AUTO_START is set, but multi-owner runtime requires explicit per-owner start via API');
  }

  // 4. Start the HTTP server
  app.listen(env.PORT, () => {
    console.log(`Synapse server listening on port ${env.PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('[FATAL] Server bootstrap failed:', err);
  process.exit(1);
});
