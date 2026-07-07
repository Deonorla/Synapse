#!/usr/bin/env tsx
/**
 * Create a corrected demo listing with SYNAPSE_PACKAGE_ID for encryption.
 * This ensures the encrypted data's packageId matches what's used in the PTB.
 */
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  console.log('Creating CORRECTED demo listing with proper package ID alignment\n');
  console.log(`Encryption packageId: ${env.SYNAPSE_PACKAGE_ID}`);
  console.log(`PTB will call: ${env.SYNAPSE_PACKAGE_ID}::marketplace::seal_approve_purchase`);
  console.log(`SessionKey will sign with: ${env.SYNAPSE_PACKAGE_ID}\n`);
  
  const content = {
    title: 'Corrected Test: Agent Memory Patterns',
    data: [
      'This listing is encrypted with SYNAPSE_PACKAGE_ID, matching the PTB.',
      'Pattern 1: Semantic chunking for MemWal storage efficiency',
      'Pattern 2: Query-time embedding similarity thresholds',  
      'Pattern 3: Memory compression via insight extraction',
      'Pattern 4: Redundancy detection before storage',
      'Pattern 5: Time-weighted memory decay for relevance',
      'Implementation: Gemini AI for extraction, MemWal for persistence',
      'Test data to verify Seal decryption works end-to-end.',
    ],
    timestamp: new Date().toISOString(),
  };
  
  const dataBytes = new TextEncoder().encode(JSON.stringify(content, null, 2));
  const policyIdBytes = crypto.randomBytes(32);
  const policyId = Buffer.from(policyIdBytes).toString('hex');
  
  console.log('Encrypting with Seal...');
  const { encryptedObject } = await sealClient.encrypt({
    kemType: 0,
    demType: 1,
    threshold: 1,
    packageId: env.SYNAPSE_PACKAGE_ID,  // ✅ CORRECTED: Use SYNAPSE_PACKAGE_ID
    id: policyId,
    data: dataBytes
  });
  
  console.log(`✅ Encrypted ${dataBytes.length} bytes`);
  console.log(`   Encrypted object size: ${encryptedObject.length} bytes`);
  console.log(`   First 50 bytes: ${Buffer.from(encryptedObject.slice(0, 50)).toString('hex')}`);
  
  // Verify the encrypted object contains SYNAPSE_PACKAGE_ID
  const synapsePackageIdClean = env.SYNAPSE_PACKAGE_ID.replace(/^0x/, '');
  const encryptedHex = Buffer.from(encryptedObject).toString('hex');
  const containsSynapseId = encryptedHex.includes(synapsePackageIdClean);
  console.log(`   Contains SYNAPSE_PACKAGE_ID: ${containsSynapseId ? '✅ YES' : '❌ NO'}`);
  
  console.log('\nUploading to Walrus (20 epochs)...');
  const uploadResult = await uploadToWalrus(new Uint8Array(encryptedObject), 20);
  console.log(`✅ Uploaded to Walrus: ${uploadResult.blobId}`);
  
  console.log('\nCreating on-chain listing...');
  const listingId = await listDataset(
    [uploadResult.blobId],
    policyId,
    {
      title: 'Corrected Test: Agent Memory Patterns',
      description: 'CORRECTED LISTING: Encrypted with SYNAPSE_PACKAGE_ID to match PTB approval function. Best practices for efficient agent memory storage on MemWal and Walrus. 20-epoch storage.',
    },
    5_000_000 // 0.005 SUI
  );
  
  console.log('\n✅ Corrected Listing Created Successfully!');
  console.log(`   Listing ID: ${listingId}`);
  console.log(`   Blob ID: ${uploadResult.blobId}`);
  console.log(`   Policy ID: ${policyId}`);
  console.log(`   Price: 0.005 SUI`);
  console.log(`\nThis listing should decrypt successfully because:`);
  console.log(`1. Encrypted with SYNAPSE_PACKAGE_ID`);
  console.log(`2. PTB calls SYNAPSE_PACKAGE_ID::marketplace::seal_approve_purchase`);
  console.log(`3. SessionKey signs with SYNAPSE_PACKAGE_ID`);
  console.log(`All three use the SAME package ID - no mismatch!`);
}

main().catch(console.error);
