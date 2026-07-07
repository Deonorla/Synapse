#!/usr/bin/env tsx
/**
 * Check if denylisted listing blobs are actually expired
 */
import { suiClient } from '../config/sui.ts';

async function main() {
  const listingIds = [
    '0xfeeb0d848946b6dd6518cb4ad9b8cf593415fa07142bbde427e4d72131f5e9b2', // Sui Defi Trading Signal
    '0xf7afe5790ef6ff60262d921076e06a521d758fc9808b001aeb11fafdf73e1098', // x402 API Rate Negotiation History
    '0x71769d7d03c31f8a666ef210ac4179760c650299c5af9cfbb3f0c6c3505315e9', // x402 API Provider Reliability Index
  ];

  for (const listingId of listingIds) {
    console.log(`\nChecking listing: ${listingId}`);
    
    try {
      const obj = await suiClient.getObject({
        id: listingId,
        options: { showContent: true },
      });
      
      const fields = (obj.data?.content as any)?.fields;
      if (!fields) {
        console.log(`  ❌ Object not found or invalid`);
        continue;
      }
      
      const title = Array.isArray(fields.title) 
        ? new TextDecoder().decode(new Uint8Array(fields.title.map(Number)))
        : fields.title;
      
      const blobIds = fields.blob_ids?.map((b: any) =>
        Array.isArray(b) ? new TextDecoder().decode(new Uint8Array(b.map(Number))) : b
      ) || [];
      
      console.log(`  Title: ${title}`);
      console.log(`  Blob IDs: ${blobIds.join(', ')}`);
      
      // Check each blob
      for (const blobId of blobIds) {
        const walrusUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;
        try {
          const response = await fetch(walrusUrl, { method: 'HEAD' });
          console.log(`  Blob ${blobId}: HTTP ${response.status} ${response.statusText}`);
        } catch (err: any) {
          console.log(`  Blob ${blobId}: ❌ ${err.message}`);
        }
      }
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
    }
  }
}

main().catch(console.error);
