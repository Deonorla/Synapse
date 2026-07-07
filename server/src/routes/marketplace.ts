import { Router } from 'express';
import { purchaseDataset, ingestDataset } from '../marketplace/buyer.ts';
import { getActiveListings, getListingById } from '../marketplace/discovery.ts';
import { requireX402Payment } from '../x402/middleware.ts';
import { getMemWal } from '../config/memwal.ts';
import { suiClient } from '../config/sui.ts';
import { saveCachedListing } from '../db/sqlite.ts';

export const marketplaceRouter = Router();

async function resolveListingIdFromDigest(digest?: string): Promise<string | undefined> {
  if (!digest) return undefined;
  try {
    const tx = await suiClient.waitForTransaction({
      digest,
      options: { showEvents: true },
    });
    const event = tx.events?.find((item: any) => item.type?.includes('DatasetListed'));
    return (event as any)?.parsedJson?.listing_id;
  } catch (error: any) {
    console.warn('[marketplace/list] Could not resolve listing id from digest:', error.message);
    return undefined;
  }
}

async function indexListing(req: any, res: any) {
  try {
    const { digest, blobId, policyId, title, description, priceMist, sellerAddress } = req.body;

    if (!title || !blobId || !sellerAddress) {
      return res.status(400).json({ error: 'title, blobId, and sellerAddress are required' });
    }

    const listingId = (await resolveListingIdFromDigest(digest)) || digest || `local_${Date.now()}`;

    await saveCachedListing({
      listingId,
      txDigest: digest,
      blobId,
      policyId: policyId || '',
      title,
      description: description || '',
      priceMist: Number(priceMist),
      sellerAddress, // User wallet address from the browser-signed transaction flow
      isActive: true,
    });

    res.json({ success: true, listingId });
  } catch (error: any) {
    console.error('[marketplace/list]', error.stack || error);
    res.status(500).json({ error: error.message });
  }
}

// Seller metadata indexing route. The browser wallet signs the on-chain listing.
marketplaceRouter.post('/list', indexListing);
marketplaceRouter.post('/indexed', indexListing);

// Discovery Routes
marketplaceRouter.get('/listings', async (req, res) => {
  try {
    const listings = await getActiveListings();
    res.json({ listings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

marketplaceRouter.get('/listings/:id', async (req, res) => {
  try {
    const listing = await getListingById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json({ listing });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buyer Routes
marketplaceRouter.post('/purchase/:id', async (req, res) => {
  try {
    const { ownerAddress } = req.body;
    if (!ownerAddress) return res.status(400).json({ error: 'ownerAddress is required' });

    const listing = await getListingById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    
    const { getActiveAgentKeypair } = await import('../agents/runtime.ts');
    const agentKeypair = await getActiveAgentKeypair(ownerAddress);
    if (!agentKeypair) return res.status(400).json({ error: 'No active agent registered.' });

    const receiptId = await purchaseDataset(listing, agentKeypair);
    res.json({ message: 'Dataset purchased successfully', receiptId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Protected Ingest Route (requires x402 payment proof)
// This is an example of an endpoint that a third party might call to trigger the agent to ingest
marketplaceRouter.post('/ingest/:id', requireX402Payment(), async (req, res) => {
  try {
    const { receiptId, ownerAddress } = req.body;
    if (!receiptId) return res.status(400).json({ error: 'Missing receiptId' });
    if (!ownerAddress) return res.status(400).json({ error: 'ownerAddress is required' });

    const listing = await getListingById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const { getActiveAgentKeypair } = await import('../agents/runtime.ts');
    const agentKeypair = await getActiveAgentKeypair(ownerAddress);
    if (!agentKeypair) return res.status(400).json({ error: 'No active agent registered.' });

    await ingestDataset(listing, receiptId, agentKeypair);
    res.json({ message: 'Dataset ingested successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Protected Query Route (requires x402 payment proof)
marketplaceRouter.post('/query', requireX402Payment(1000000), async (req, res) => {
  try {
    const { query, ownerAddress } = req.body;
    if (!query) return res.status(400).json({ error: 'Missing query' });
    if (!ownerAddress) return res.status(400).json({ error: 'ownerAddress is required' });

    const { getActiveAgentKeypair } = await import('../agents/runtime.ts');
    const agentKeypair = await getActiveAgentKeypair(ownerAddress);
    if (!agentKeypair) return res.status(400).json({ error: 'No active agent registered.' });
    
    const agentAddress = agentKeypair.getPublicKey().toSuiAddress();

    // Call MemWal recall
    const memwal = getMemWal(agentAddress);
    const context = await memwal.recall(query);
    
    // In a full implementation, we'd pass context to Gemini here.
    // For now, return the raw context.
    res.json({ answer: `Synthesized answer for: ${query}`, context });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
