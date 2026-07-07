import { Router } from 'express';
import { startAgentLoop, stopAgentLoop, getAgentStatus, registerAgent, getAgentLogs } from '../agents/runtime.ts';
import { getAgentWallet, getPurchases } from '../db/sqlite.ts';

export const agentRouter = Router();

agentRouter.post('/register', async (req, res) => {
  const ownerAddress = req.body.ownerAddress || req.body.ownerPublicKey;
  if (!ownerAddress) {
    return res.status(400).json({ error: 'ownerAddress is required' });
  }
  try {
    const result = await registerAgent({ ownerPublicKey: ownerAddress });
    res.json({ message: 'Agent registered successfully', ownerAddress, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

agentRouter.get('/wallet', async (req, res) => {
  const ownerAddress = req.query.ownerAddress as string | undefined;
  if (!ownerAddress) {
    return res.status(400).json({ error: 'ownerAddress query parameter is required' });
  }
  
  const wallet = await getAgentWallet(ownerAddress);
  if (!wallet) {
    return res.status(404).json({ error: 'No agent wallet found. Register first.' });
  }
  return res.json({ publicKey: wallet.agentAddress, agentAddress: wallet.agentAddress, ownerAddress });
});

agentRouter.post('/start', async (req, res) => {
  try {
    await startAgentLoop(req.body?.ownerAddress || req.body?.ownerPublicKey);
    res.json({ message: 'Agent started' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

agentRouter.post('/stop', (req, res) => {
  try {
    const ownerAddress = req.body?.ownerAddress || req.body?.ownerPublicKey;
    if (!ownerAddress) {
      return res.status(400).json({ error: 'ownerAddress is required' });
    }
    stopAgentLoop(ownerAddress);
    res.json({ message: 'Agent stopped' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

agentRouter.get('/status', async (req, res) => {
  const ownerAddress = req.query.ownerAddress as string | undefined;
  if (!ownerAddress) {
    return res.status(400).json({ error: 'ownerAddress query parameter is required' });
  }
  res.json(await getAgentStatus(ownerAddress));
});

agentRouter.get('/logs', (req, res) => {
  const ownerAddress = req.query.ownerAddress as string | undefined;
  if (!ownerAddress) {
    return res.status(400).json({ error: 'ownerAddress query parameter is required' });
  }
  res.json({ logs: getAgentLogs(ownerAddress) });
});

agentRouter.get('/purchases', async (req, res) => {
  try {
    const ownerAddress = req.query.ownerAddress as string;
    if (!ownerAddress) {
      return res.status(400).json({ error: 'ownerAddress query parameter is required' });
    }
    const purchases = await getPurchases(ownerAddress);
    res.json({ purchases });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
