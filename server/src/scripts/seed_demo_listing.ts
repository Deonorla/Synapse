#!/usr/bin/env tsx
/**
 * ⚠️ DEPRECATED - DO NOT USE
 * This script encrypts with SEAL_PACKAGE_ID which does not have the marketplace module.
 * Use seed_corrected_listing.ts instead, which encrypts with SYNAPSE_PACKAGE_ID.
 * Kept for historical reference only.
 * 
 * Seeds a fresh demo listing with real Walrus storage (epochs=20)
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  console.log('[Seed] Creating fresh demo listing with epochs=20...');
  
  // 1. Create sample dataset content
  const content = {
    title: 'Fresh Synapse Agent Memory Demo Dataset',
    data: [
      'Knowledge chunk 1: Sui Move agents can store memory on Walrus through MemWal',
      'Knowledge chunk 2: Seal provides threshold encryption for dataset access control',
      'Knowledge chunk 3: Autonomous agents can purchase, decrypt, and learn from marketplace data',
      'Knowledge chunk 4: Memory persistence enables true agent learning across sessions',
      'Knowledge chunk 5: This dataset will outlive the demo with epochs=20 storage'
    ],
    timestamp: new Date().toISOString(),
  };
  
  const jsonData = JSON.stringify(content, null, 2);
  const dataBytes = new TextEncoder().encode(jsonData);
  
  console.log(`[Seed] Dataset size: ${dataBytes.length} bytes`);
  
  // 2. Generate random 32-byte policy ID
  const policyIdBytes = crypto.randomBytes(32);
  const policyId = Buffer.from(policyIdBytes).toString('hex');
  console.log(`[Seed] Generated Seal policy ID: ${policyId}`);
  
  // 3. Encrypt with Seal
  console.log('[Seed] Encrypting with Seal...');
  const { encryptedObject } = await sealClient.encrypt({
    kemType: 0, // Secp256r1
    demType: 1, // AES-256-GCM
    threshold: 1, // Require at least 1 key server
    packageId: env.SEAL_PACKAGE_ID,
    id: policyId,
    data: dataBytes
  });
  
  const encrypted = new Uint8Array(encryptedObject);
  console.log(`[Seed] Encrypted size: ${encrypted.length} bytes`);
  
  // 4. Upload to Walrus with epochs=20
  console.log('[Seed] Uploading to Walrus with epochs=20...');
  const uploadResult = await uploadToWalrus(encrypted, 20);
  console.log(`[Seed] ✅ Uploaded to Walrus!`);
  console.log(`[Seed]    Blob ID: ${uploadResult.blobId}`);
  console.log(`[Seed]    Sui Object: ${uploadResult.suiObjectId}`);
  console.log(`[Seed]    Storage: epochs=20 (endEpoch: ${431 + 20})`);
  
  // Verify download works immediately
  console.log('[Seed] Verifying download...');
  const verifyResponse = await fetch(`${env.WALRUS_AGGREGATOR_URL}/v1/blobs/${uploadResult.blobId}`);
  if (verifyResponse.ok) {
    const downloadedSize = (await verifyResponse.arrayBuffer()).byteLength;
    console.log(`[Seed] ✅ Download verified! Size: ${downloadedSize} bytes`);
  } else {
    console.error(`[Seed] ❌ Download verification failed: ${verifyResponse.status}`);
  }
  
  // 5. List on marketplace
  console.log('[Seed] Listing on marketplace...');
  const keypair = Ed25519Keypair.fromSecretKey(env.SUI_PRIVATE_KEY);
  const sellerAddress = keypair.getPublicKey().toSuiAddress();
  console.log(`[Seed] Seller address: ${sellerAddress}`);
  
  const listingId = await listDataset(
    [uploadResult.blobId],
    policyId,
    {
      title: 'Fresh Synapse Agent Memory Demo (epochs=20)',
      description: 'Real Walrus-backed dataset with 20-epoch storage. Contains knowledge about Sui, MemWal, Seal, and autonomous agent memory systems. Perfect for testing agent learning loops.',
    },
    10_000_000 // 0.01 SUI
  );
  
  console.log('\n[Seed] ✅ LISTING CREATED!');
  console.log(`[Seed]    Listing ID: ${listingId}`);
  console.log(`[Seed]    Blob ID: ${uploadResult.blobId}`);
  console.log(`[Seed]    Seal Policy: ${policyId}`);
  console.log(`[Seed]    Price: 0.01 SUI`);
  console.log(`[Seed]    Storage: epochs=20 (endEpoch: 451)`);
  console.log(`[Seed]    Verify: https://aggregator.walrus-testnet.walrus.space/v1/blobs/${uploadResult.blobId}`);
}

main().catch(console.error);
