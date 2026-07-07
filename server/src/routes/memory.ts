import { Router } from 'express';
import { getMemWalClient, agentNamespace, isMemWalConfigured } from '../memory/memwal.ts';

export const memoryRouter = Router();

memoryRouter.get('/health', async (_req, res) => {
  if (!isMemWalConfigured()) {
    return res.json({
      status: 'not_configured',
      message: 'Set MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID in server/.env (get from https://memwal.wal.app)',
    });
  }

  try {
    const client = getMemWalClient();
    const health = await client.health();
    res.json({ status: 'ok', relayer: health });
  } catch (error: any) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});

memoryRouter.get('/count', async (req, res) => {
  if (!isMemWalConfigured()) {
    return res.json({ count: 0, status: 'not_configured' });
  }

  try {
    const { agentAddress } = req.query;
    if (!agentAddress) {
      return res.status(400).json({ error: 'agentAddress is required' });
    }

    const client = getMemWalClient();
    const namespace = agentNamespace(agentAddress as string);
    
    // Use a very broad query that matches dataset-related content
    // The agent stores memories as "[Dataset: {title}] Key insights: ..."
    const result = await client.recall({
      query: 'Dataset insights agent trading optimization security patterns analysis DeFi memory',
      limit: 100,  // Get all memories up to 100
      namespace,
    });
    
    // Return the actual number of results, not the 'total' field which is query-dependent
    res.json({ count: result.results.length, namespace });
  } catch (error: any) {
    console.error('[Memory Count] Error:', error);
    res.status(500).json({ error: error.message, count: 0 });
  }
});

memoryRouter.get('/recall', async (req, res) => {
  try {
    const { query, agentAddress, limit = '5' } = req.query;
    if (!query || !agentAddress) {
      return res.status(400).json({ error: 'query and agentAddress are required' });
    }

    const client = getMemWalClient();
    const namespace = agentNamespace(agentAddress as string);
    const result = await client.recall({
      query: query as string,
      limit: Number.parseInt(limit as string, 10),
      namespace,
    });
    res.json({ memories: result.results, namespace, total: result.total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

memoryRouter.post('/remember', async (req, res) => {
  try {
    const { text, agentAddress } = req.body;
    if (!text || !agentAddress) {
      return res.status(400).json({ error: 'text and agentAddress are required' });
    }

    const client = getMemWalClient();
    const namespace = agentNamespace(agentAddress);
    const job = await client.remember(text, namespace);
    res.json({ message: 'Memory store accepted', job, namespace });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

memoryRouter.post('/recall', async (req, res) => {
  try {
    const { query, agentAddress, limit = 5 } = req.body;
    if (!query || !agentAddress) {
      return res.status(400).json({ error: 'query and agentAddress are required' });
    }

    const client = getMemWalClient();
    const namespace = agentNamespace(agentAddress);
    const result = await client.recall({ query, limit: Number(limit), namespace });
    res.json({ memories: result.results, namespace, total: result.total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

memoryRouter.post('/restore', async (req, res) => {
  try {
    const { agentAddress, limit = 10 } = req.body;
    if (!agentAddress) {
      return res.status(400).json({ error: 'agentAddress is required' });
    }

    const namespace = agentNamespace(agentAddress);
    const result = await getMemWalClient().restore(namespace, Number(limit));
    res.json({ message: 'Restore complete', result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
