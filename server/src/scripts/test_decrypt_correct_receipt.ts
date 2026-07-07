#!/usr/bin/env tsx
/**
 * Test decryption with the CORRECT receipt ID
 */
import { env } from '../config/env.ts';
import { initializeKeypair } from '../config/sui.ts';
import { createSessionKey, buildApprovalTransaction } from '../seal/session.ts';
import { sealDecrypt } from '../seal/decrypt.ts';

const CORRECTED_LISTING_ID = '0x6eaa79b79d600029c8ef9baeaeeb833c3a456053f8aa0d3df39d14e26ef90b29';
const CORRECTED_BLOB_ID = '5WlqO7CufaGbcUMesH6o0VGr1lir6w3imxlCnIWmsTg';
const CORRECT_RECEIPT_ID = '0xa14b27603a17e1580eb34dd5dc5a5a32c5cab665bc03689c43de6b2565f6ca06';
const POLICY_ID = '350ba92a584266cad97ed1a4b2aa0cdbbf597acd3a9ee2cb9670106df307d638';

async function main() {
  console.log('='.repeat(70));
  console.log('FINAL DECRYPTION TEST WITH CORRECT RECEIPT');
  console.log('='.repeat(70));
  console.log(`\nListing: ${CORRECTED_LISTING_ID}`);
  console.log(`Receipt: ${CORRECT_RECEIPT_ID}`);
  console.log(`Blob: ${CORRECTED_BLOB_ID}\n`);
  
  const buyerKeypair = initializeKeypair(env.SUI_PRIVATE_KEY);
  const buyerAddress = buyerKeypair.getPublicKey().toSuiAddress();
  console.log(`Buyer: ${buyerAddress}\n`);
  
  // Download
  console.log('Step 1: Downloading from Walrus...');
  const walrusUrl = `${env.WALRUS_AGGREGATOR_URL}/v1/blobs/${CORRECTED_BLOB_ID}`;
  const response = await fetch(walrusUrl);
  if (!response.ok) throw new Error(`Walrus: ${response.status}`);
  const rawBytes = new Uint8Array(await response.arrayBuffer());
  console.log(`✅ Downloaded ${rawBytes.length} bytes\n`);
  
  // Session key
  console.log('Step 2: Creating session key...');
  const sessionKey = await createSessionKey(buyerAddress, buyerKeypair);
  
  // PTB
  console.log('\nStep 3: Building approval transaction...');
  const txBytes = await buildApprovalTransaction(
    CORRECTED_LISTING_ID,
    CORRECT_RECEIPT_ID,  // Using the CORRECT receipt ID now
    buyerAddress,
    POLICY_ID
  );
  console.log(`✅ PTB built (${txBytes.length} bytes)\n`);
  
  // Decrypt
  console.log('Step 4: Decrypting with Seal...\n');
  console.log('='.repeat(70));
  
  try {
    const decrypted = await sealDecrypt(rawBytes, sessionKey, txBytes);
    
    console.log('✅✅✅ DECRYPTION SUCCEEDED! ✅✅✅');
    console.log('='.repeat(70));
    console.log(`\nDecrypted content (${decrypted.length} chars):\n`);
    console.log(decrypted);
    console.log('\n' + '='.repeat(70));
    console.log('🎉 END-TO-END SEAL ENCRYPTION/DECRYPTION WORKING! 🎉');
    console.log('='.repeat(70));
    console.log('\nAll package IDs aligned:');
    console.log(`1. Encryption: SYNAPSE_PACKAGE_ID`);
    console.log(`2. SessionKey: SYNAPSE_PACKAGE_ID`);
    console.log(`3. PTB target: SYNAPSE_PACKAGE_ID::marketplace::seal_approve_purchase`);
    console.log(`4. Receipt matches listing`);
    console.log(`5. Signature validates successfully`);
    console.log(`6. Access control passes`);
    console.log(`7. Seal threshold servers return decryption keys`);
    console.log(`8. Data decrypts to plaintext ✅\n`);
    
  } catch (err) {
    console.log('❌ DECRYPTION FAILED');
    console.log('='.repeat(70));
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) {
      console.error('\nStack:');
      console.error(err.stack);
    }
    throw err;
  }
}

main().catch(console.error);
