import { suiClient } from '../config/sui.ts';
import { env, hasRealContracts } from '../config/env.ts';
import { DatasetListing } from './types.ts';
import { getCachedListings, saveCachedListing, clearCachedListings } from '../db/sqlite.ts';

/**
 * DENYLIST: Stale listings with dead Walrus blobs.
 * These listing IDs are permanently filtered from discovery, sync, and agent evaluation.
 * Created 2026-06-17: 11 old server-wallet listings with expired/non-existent blobs.
 */
const DENYLISTED_LISTING_IDS = new Set([
  '0xb00d3925effff0dd74d2086f78c27dd7fab59e40d619a80d874696159887c24a',
  '0x95dae9f040318478142c329bd5af3b8baa9299baf96ce4fbdc7a6f4eda67c29e',
  '0x670a1d17425856096122b53d475d6fec9b9342629992a3705d2624d240bca9f8',
  '0xeacd171917a535f6a85e031dcb615b987389e1df21e2808adb58f41ab270f023',
  '0x3209f4fe346d46ab2d2bc2441f242a2d6abbce2436cee9fbc5f0fc26df7f1788',
  '0xe7886a9937ea8c5149b085ab9108bd494059cb50259616a7cc5641c702772ed5',
  '0xed0232b6dcca65393d59a6f76e57d05d8c5243b1cbae8822bfdf638ed38b8fdc',
  '0x71769d7d03c31f8a666ef210ac4179760c650299c5af9cfbb3f0c6c3505315e9',
  '0xf7afe5790ef6ff60262d921076e06a521d758fc9808b001aeb11fafdf73e1098',
  '0xfeeb0d848946b6dd6518cb4ad9b8cf593415fa07142bbde427e4d72131f5e9b2',
  '0x63417f119215be49973c48a5037a27d772e6c2f84d0d07d212a422a36cb6deb2',
]);

const MOCK_LISTING: DatasetListing = {
  id: "mock_listing_id_1",
  listingId: "mock_listing_id_1",
  owner: "0x123",
  sellerAddress: "0x123",
  title: "DeFi Alpha Signals (May 2026)",
  description: "Proprietary trading signals backtested on Sui DEXs.",
  priceMist: 5000000, // 0.005 SUI
  blobId: "blob_1",
  blobIds: ["blob_1", "blob_2"],
  chunkCount: 2,
  sealPolicyId: "mock_policy_id_1",
  isActive: true,
  createdAt: Date.now(),
};

function decodeTextBytes(value: any): string {
  if (Array.isArray(value)) return new TextDecoder().decode(new Uint8Array(value.map(Number)));
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function decodeHexBytes(value: any): string {
  if (Array.isArray(value)) {
    return value.map((byte: any) => Number(byte).toString(16).padStart(2, '0')).join('');
  }
  if (typeof value === 'string') return value.replace(/^0x/, '');
  return '';
}

/**
 * Browses all active marketplace listings.
 */
export async function getActiveListings(): Promise<DatasetListing[]> {
  const cachedListings = await getCachedListings();

  if (!hasRealContracts) {
    console.log(`[Discovery] No real contracts, returning mock data`);
    return cachedListings.length ? cachedListings : [MOCK_LISTING];
  }

  console.log(`[Discovery] Querying active listings from marketplace...`);
  try {
    const events = await suiClient.queryEvents({
      query: { MoveEventType: `${env.SYNAPSE_PACKAGE_ID}::marketplace::DatasetListed` },
      limit: 50,
      order: 'descending'
    });
    
    const objectIds = events.data.map((e: any) => (e.parsedJson as any).listing_id);
    if (objectIds.length === 0) return cachedListings.filter(l => !DENYLISTED_LISTING_IDS.has(l.id));

    const objects = await suiClient.multiGetObjects({
      ids: objectIds,
      options: { showContent: true }
    });

    const listings: DatasetListing[] = [];
    for (const obj of objects) {
      if (obj.data?.content?.dataType === 'moveObject') {
        const fields = obj.data.content.fields as any;
        const listingId = obj.data.objectId;
        
        // DENYLIST FILTER: Skip stale listings
        if (DENYLISTED_LISTING_IDS.has(listingId)) {
          console.log(`[Discovery] Filtered denylisted listing: ${listingId}`);
          continue;
        }
        
        if (fields.is_active) {
          listings.push({
            id: listingId,
            listingId: listingId,
            owner: fields.owner,
            sellerAddress: fields.owner,
            title: fields.title,
            description: fields.description,
            priceMist: Number(fields.price_mist),
            blobId: fields.blob_ids.map(decodeTextBytes)[0] || '',
            blobIds: fields.blob_ids.map(decodeTextBytes),
            chunkCount: Number(fields.chunk_count),
            sealPolicyId: decodeHexBytes(fields.seal_policy_id),
            isActive: fields.is_active,
            createdAt: Number(fields.created_at)
          });
        }
      }
    }
    
    const merged = new Map<string, DatasetListing>();
    for (const listing of cachedListings) {
      if (!DENYLISTED_LISTING_IDS.has(listing.id)) {
        merged.set(listing.id, listing);
      }
    }
    for (const listing of listings) merged.set(listing.id, listing);
    return [...merged.values()];
  } catch (err) {
    console.error(`[Discovery] Failed to query listings:`, err);
    return cachedListings.filter(l => !DENYLISTED_LISTING_IDS.has(l.id));
  }
}

export async function getListingById(listingId: string): Promise<DatasetListing | null> {
  if (listingId === "mock_listing_id_1" || !hasRealContracts) return MOCK_LISTING;

  // DENYLIST FILTER: Return null for denylisted listings
  if (DENYLISTED_LISTING_IDS.has(listingId)) {
    console.log(`[Discovery] Blocked denylisted listing query: ${listingId}`);
    return null;
  }

  const obj = await suiClient.getObject({
    id: listingId,
    options: { showContent: true }
  });

  if (obj.data?.content?.dataType === 'moveObject') {
    const fields = obj.data.content.fields as any;
    return {
      id: obj.data.objectId,
      listingId: obj.data.objectId,
      owner: fields.owner,
      sellerAddress: fields.owner,
      title: fields.title,
      description: fields.description,
      priceMist: Number(fields.price_mist),
      blobId: fields.blob_ids.map(decodeTextBytes)[0] || '',
      blobIds: fields.blob_ids.map(decodeTextBytes),
      chunkCount: Number(fields.chunk_count),
      sealPolicyId: decodeHexBytes(fields.seal_policy_id),
      isActive: fields.is_active,
      createdAt: Number(fields.created_at)
    };
  }
  return null;
}

export async function getPrice(listingId: string): Promise<number> {
  const listing = await getListingById(listingId);
  return listing?.priceMist || 5000000; 
}

export async function getSeller(listingId: string): Promise<string> {
  const listing = await getListingById(listingId);
  return listing?.owner || "0x123";
}

/**
 * Syncs listings from on-chain DatasetListed events into the local SQLite cache.
 * Clears stale entries first, then re-populates with the real seller address.
 */
export async function syncListingsFromChain(): Promise<void> {
  if (!hasRealContracts) {
    console.log('[sync] No real contracts configured, skipping chain sync');
    return;
  }

  console.log('[sync] Fetching DatasetListed events from chain...');
  
  const { data: events } = await suiClient.queryEvents({
    query: { MoveEventType: `${env.SYNAPSE_PACKAGE_ID}::marketplace::DatasetListed` },
    limit: 100,
    order: 'descending',
  });

  console.log(`[sync] Found ${events.length} on-chain listing events`);
  if (events.length === 0) return;

  // Clear stale cached listings before re-populating
  await clearCachedListings();

  let synced = 0;
  let filtered = 0;
  for (const event of events) {
    const parsed = event.parsedJson as any;
    if (!parsed?.listing_id) continue;

    // DENYLIST FILTER: Skip stale listings
    if (DENYLISTED_LISTING_IDS.has(parsed.listing_id)) {
      console.log(`[sync] Filtered denylisted listing: ${parsed.listing_id}`);
      filtered++;
      continue;
    }

    try {
      const obj = await suiClient.getObject({
        id: parsed.listing_id,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as any)?.fields;
      if (!fields) continue;

      await saveCachedListing({
        listingId: parsed.listing_id,
        title: decodeTextBytes(fields.title),
        description: decodeTextBytes(fields.description),
        priceMist: Number(fields.price_mist || 0),
        blobId: fields.blob_ids?.length ? decodeTextBytes(fields.blob_ids[0]) : '',
        policyId: decodeHexBytes(fields.seal_policy_id),
        sellerAddress: fields.owner || parsed.owner, // real seller address from chain
        isActive: fields.is_active !== false,
      });
      synced++;
    } catch (err: any) {
      console.warn(`[sync] Failed to fetch listing ${parsed.listing_id}:`, err.message);
    }
  }

  console.log(`[sync] Chain sync complete — ${synced} listings cached, ${filtered} filtered (denylisted)`);
}
