#!/usr/bin/env tsx
/**
 * Purchase and decrypt the corrected listing to verify end-to-end Seal decryption works
 */
import { env } from '../config/env.ts';
import { suiClient } from '../config/sui.ts';
import { purchaseDatasetWithReceipt } from '../marketplace/buyer.ts';
import { initializeKeypair } from '../config/sui.ts';
import { createSessionKey, buildApprovalTransaction } from '../seal/session.ts';
import { sealDecrypt } from '../seal/decrypt.ts';

const CORRECTED_LISTING_ID = '0x6eaa79b79d600029c8ef9baeaeeb833c3a456053f8aa0d3df39d14e26ef90b29';
const CORRECTED_BLOB_ID = '5WlqO7CufaGbcUMesH6o0VGr1lir6w3imxlCnIWmsTg';

async function main() {
  console.log('Testing Corrected Listing Decryption\n');
  console.log(`Listing ID: ${CORRECTED_LISTING_ID}`);
  console.log(`Blob ID: ${CORRECTED_BLOB_ID}\n`);
  
  // Use the hot wallet keypair for testing
  const buyerKeypair = initializeKeypair(env.SUI_PRIVATE_KEY);
  const buyerAddress = buyerKeypair.getPublicKey().toSuiAddress();
  console.log(`Buyer address: ${buyerAddress}\n`);
  
  // Fetch listing
  const listingObj = await suiClient.getObject({
    id: CORRECTED_LISTING_ID,
    options: { showContent: true }
  });
  
  if (listingObj.data?.content?.dataType !== 'moveObject') {
    throw new Error('Listing not found');
  }
  
  const fields = listingObj.data.content.fields as any;
  const policyIdBytes = fields.seal_policy_id;
  const policyId = Array.isArray(policyIdBytes)
    ? policyIdBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')
    : String(policyIdBytes);
  
  console.log(`Policy ID: ${policyId}\n`);
  
  // Purchase
  console.log('Step 1: Purchasing listing...');
  const purchase = await purchaseDatasetWithReceipt({
    id: CORRECTED_LISTING_ID,
    listingId: CORRECTED_LISTING_ID,
    blobIds: [CORRECTED_BLOB_ID],
    sealPolicyId: policyId,
    priceMist: '5000000',
    title: 'Corrected Test',
  } as any, buyerKeypair);
  
  console.log(`✅ Purchased! TX: ${purchase.txDigest}`);
  console.log(`   Receipt ID: ${purchase.receiptId}\n`);
  
  // Download
  console.log('Step 2: Downloading encrypted data from Walrus...');
  const walrusUrl = `${env.WALRUS_AGGREGATOR_URL}/v1/blobs/${CORRECTED_BLOB_ID}`;
  const response = await fetch(walrusUrl);
  if (!response.ok) throw new Error(`Walrus fetch failed: ${response.status}`);
  const rawBytes = new Uint8Array(await response.arrayBuffer());
  console.log(`✅ Downloaded ${rawBytes.length} bytes`);
  console.log(`   First 50 bytes: ${Buffer.from(rawBytes.slice(0, 50)).toString('hex')}\n`);
  
  // Verify it contains SYNAPSE_PACKAGE_ID
  const synapsePackageIdClean = env.SYNAPSE_PACKAGE_ID.replace(/^0x/, '');
  const containsSynapseId = Buffer.from(rawBytes).toString('hex').includes(synapsePackageIdClean);
  console.log(`   Contains SYNAPSE_PACKAGE_ID: ${containsSynapseId ? '✅ YES' : '❌ NO'}\n`);
  
  // Decrypt
  console.log('Step 3: Creating session key...');
  const sessionKey = await createSessionKey(buyerAddress, buyerKeypair);
  
  console.log('\nStep 4: Building approval transaction...');
  const txBytes = await buildApprovalTransaction(
    CORRECTED_LISTING_ID,
    purchase.receiptId,
    buyerAddress,
    policyId
  );
  console.log(`✅ Built PTB (${txBytes.length} bytes)\n`);
  
  console.log('Step 5: Decrypting with Seal...');
  console.log('This should succeed because all package IDs are aligned!\n');
  
  try {
    const decrypted = await sealDecrypt(rawBytes, sessionKey, txBytes);
    
    console.log('='.repeat(70));
    console.log('✅✅✅ DECRYPTION SUCCEEDED! ✅✅✅');
    console.log('='.repeat(70));
    console.log(`\nDecrypted ${decrypted.length} characters:`);
    console.log(decrypted);
    console.log('\n' + '='.repeat(70));
    console.log('SUCCESS: End-to-end Seal encryption/decryption working!');
    console.log('='.repeat(70));
    
  } catch (err) {
    console.log('='.repeat(70));
    console.log('❌ DECRYPTION FAILED');
    console.log('='.repeat(70));
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) {
      console.error('\nStack trace:');
      console.error(err.stack);
    }
    throw err;
  }
}

main().catch(console.error);
