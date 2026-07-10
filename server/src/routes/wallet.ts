import { Router } from 'express';
import { saveClientWallet, getClientWallet } from '../db/sqlite.ts';
import { requireGoogleAuth } from '../middleware/auth.ts';

export const walletRouter = Router();

/**
 * POST /api/wallet/client
 * Save (sync) the client's managed keypair to the server, encrypted.
 * Requires Google auth. Body: { encryptedSecretKey: string, suiAddress: string }
 */
walletRouter.post('/client', requireGoogleAuth, async (req, res) => {
  const googleUserId = req.googleUser!.sub;
  const { secretKey, suiAddress } = req.body;

  if (!secretKey || !suiAddress) {
    return res.status(400).json({ error: 'secretKey and suiAddress are required' });
  }

  try {
    await saveClientWallet(googleUserId, secretKey, suiAddress);
    res.json({ message: 'Client wallet backed up successfully', suiAddress });
  } catch (error: any) {
    console.error('[wallet] Failed to save client wallet:', error);
    res.status(500).json({ error: 'Failed to save client wallet' });
  }
});

/**
 * GET /api/wallet/client
 * Retrieve the client's backed-up keypair from the server.
 * Requires Google auth. Returns { secretKey: string, suiAddress: string }
 */
walletRouter.get('/client', requireGoogleAuth, async (req, res) => {
  const googleUserId = req.googleUser!.sub;

  try {
    const wallet = await getClientWallet(googleUserId);
    if (!wallet) {
      return res.status(404).json({ error: 'No backed-up client wallet found' });
    }
    res.json({ secretKey: wallet.privateKeyStr, suiAddress: wallet.suiAddress });
  } catch (error: any) {
    console.error('[wallet] Failed to retrieve client wallet:', error);
    res.status(500).json({ error: 'Failed to retrieve client wallet' });
  }
});
