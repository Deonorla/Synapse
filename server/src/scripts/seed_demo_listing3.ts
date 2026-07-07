#!/usr/bin/env tsx
/**
 * ⚠️ DEPRECATED - DO NOT USE
 * This script encrypts with SEAL_PACKAGE_ID which does not have the marketplace module.
 * Use seed_corrected_listing.ts instead, which encrypts with SYNAPSE_PACKAGE_ID.
 * Kept for historical reference only.
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  const content = {
    title: 'Agent Memory Optimization Patterns',
    data: [
      'Pattern 1: Semantic chunking for MemWal storage efficiency',
      'Pattern 2: Query-time embedding similarity thresholds',
      'Pattern 3: Memory compression via insight extraction',
      'Pattern 4: Redundancy detection before storage',
      'Pattern 5: Time-weighted memory decay for relevance',
      'Implementation: Gemini AI for extraction, MemWal for persistence',
    ],
    timestamp: new Date().toISOString(),
  };
  
  const dataBytes = new TextEncoder().encode(JSON.stringify(content, null, 2));
  const policyIdBytes = crypto.randomBytes(32);
  const policyId = Buffer.from(policyIdBytes).toString('hex');
  
  const { encryptedObject } = await sealClient.encrypt({
    kemType: 0,
    demType: 1,
    threshold: 1,
    packageId: env.SEAL_PACKAGE_ID,
    id: policyId,
    data: dataBytes
  });
  
  const uploadResult = await uploadToWalrus(new Uint8Array(encryptedObject), 20);
  
  const listingId = await listDataset(
    [uploadResult.blobId],
    policyId,
    {
      title: 'Agent Memory Optimization Patterns',
      description: 'Best practices for efficient agent memory storage on MemWal and Walrus. Covers semantic chunking, redundancy detection, and memory decay strategies. 20-epoch storage.',
    },
    8_000_000 // 0.008 SUI
  );
  
  console.log('\n✅ Listing 3 Created:');
  console.log(`   Listing ID: ${listingId}`);
  console.log(`   Blob ID: ${uploadResult.blobId}`);
  console.log(`   Price: 0.008 SUI`);
}

main().catch(console.error);
