#!/usr/bin/env tsx
/**
 * Debug script to isolate Seal decryption failure without spending another purchase.
 * Tests decryption on already-purchased "Agent Memory Optimization Patterns" listing.
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { env } from '../config/env.ts';
import { suiClient } from '../config/sui.ts';
import { createSessionKey, buildApprovalTransaction } from '../seal/session.ts';
import { sealDecrypt } from '../seal/decrypt.ts';

const LISTING_ID = '0x1886cf25bc167d85799214cc7a5f60ddf2476e40a4121c126d24beae07521212';
const BLOB_ID = 'ZzasE5zqnFxzFjwPmfdUaf4oBtPCAjRR43h7dWHcIdE';
const RECEIPT_ID = '0x62a5decc22fc2fc91971f04703275b9688943d720da63e8f44e4f18303d8e495';

async function main() {
  console.log('[Debug] Starting Seal decryption diagnosis...\n');
  
  // 1. Find which agent actually made this purchase
  console.log(`[Debug] Checking who purchased this listing...`);
  const receiptObj = await suiClient.getObject({
    id: RECEIPT_ID,
    options: { showContent: true, showOwner: true }
  });
  
  if (!receiptObj.data?.owner || !('AddressOwner' in receiptObj.data.owner)) {
    throw new Error('Receipt owner not found');
  }
  
  const receiptOwner = receiptObj.data.owner.AddressOwner;
  console.log(`[Debug] Receipt is owned by agent: ${receiptOwner}\n`);
  
  // 2. Load the CORRECT agent keypair (the one that made the purchase)
  console.log(`[Debug] Loading agent keypair from database...`);
  const { getAgentWallet } = await import('../db/sqlite.ts');
  
  //Find the owner address for this agent
  const sqlite3 = await import('sqlite3');
  const { open } = await import('sqlite');
  const db = await open({
    filename: '/Users/ola/Documents/Github/Synapse/server/data/agents.db',
    driver: sqlite3.default.Database
  });
  
  const ownerRow = await db.get(
    'SELECT owner_address FROM agent_wallets WHERE agent_address = ?',
    receiptOwner
  );
  
  if (!ownerRow) {
    throw new Error(`Owner not found for agent ${receiptOwner}`);
  }
  
  console.log(`[Debug] Agent owner address: ${ownerRow.owner_address}`);
  
  const walletData = await getAgentWallet(ownerRow.owner_address);
  if (!walletData) {
    throw new Error(`Wallet data not found for owner ${ownerRow.owner_address}`);
  }
  
  // Use the same initialization logic as the main codebase
  const { initializeKeypair } = await import('../config/sui.ts');
  const agentKeypair = initializeKeypair(walletData.privateKeyStr);
  const agentAddress = agentKeypair.getPublicKey().toSuiAddress();
  console.log(`[Debug] ✅ Loaded agent keypair, address: ${agentAddress}`);
  console.log(`[Debug] Address match with receipt: ${agentAddress === receiptOwner ? '✅ YES' : '❌ NO'}\n`);
  
  // 3. Fetch the listing object from chain to get the stored policy ID
  console.log(`[Debug] Fetching listing object from chain...`);
  const listingObj = await suiClient.getObject({
    id: LISTING_ID,
    options: { showContent: true }
  });
  
  if (listingObj.data?.content?.dataType !== 'moveObject') {
    throw new Error('Listing object not found or invalid');
  }
  
  const fields = listingObj.data.content.fields as any;
  const onChainPolicyIdBytes = fields.seal_policy_id;
  
  // Convert on-chain bytes to hex string
  const onChainPolicyId = Array.isArray(onChainPolicyIdBytes)
    ? onChainPolicyIdBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')
    : String(onChainPolicyIdBytes);
  
  console.log(`[Debug] On-chain policy ID: ${onChainPolicyId}`);
  console.log(`[Debug] On-chain policy ID length: ${onChainPolicyId.length} chars\n`);
  
  // 3. Get the seed script's policy ID (from the script that created this listing)
  // Since we don't have it logged, we'll compare what we're about to use with what's on-chain
  console.log(`[Debug] ⚠️  NOTE: The seed script generated a random policy ID that should match the above.`);
  console.log(`[Debug] ⚠️  If decryption fails, this mismatch is the likely cause.\n`);
  
  // 4. Fetch encrypted bytes from Walrus
  console.log(`[Debug] Fetching encrypted blob from Walrus...`);
  const walrusUrl = `${env.WALRUS_AGGREGATOR_URL}/v1/blobs/${BLOB_ID}`;
  console.log(`[Debug] Walrus URL: ${walrusUrl}`);
  
  const walrusResponse = await fetch(walrusUrl);
  if (!walrusResponse.ok) {
    throw new Error(`Walrus fetch failed: ${walrusResponse.status} ${walrusResponse.statusText}`);
  }
  
  const rawBytes = new Uint8Array(await walrusResponse.arrayBuffer());
  console.log(`[Debug] ✅ Downloaded ${rawBytes.length} bytes from Walrus`);
  console.log(`[Debug] First 50 bytes (hex): ${Buffer.from(rawBytes.slice(0, 50)).toString('hex')}\n`);
  
  // 5. Verify the on-chain policy ID is embedded in the encrypted data
  // 5. Note: Policy ID is embedded in Seal's encrypted format, but we'll let Seal SDK handle verification
  console.log(`[Debug] Policy ID from chain listing: ${onChainPolicyId}\n`);
  
  // 6. Attempt decryption with full error visibility
  console.log(`[Debug] ========================================`);
  console.log(`[Debug] ATTEMPTING SEAL DECRYPTION`);
  console.log(`[Debug] ========================================\n`);
  
  try {
    console.log(`[Debug] Step 1: Creating session key...`);
    const sessionKey = await createSessionKey(agentAddress, agentKeypair);
    console.log(`[Debug] ✅ Session key created`);
    console.log(`[Debug] Session key details:`, {
      isExpired: sessionKey.isExpired(),
      // Don't log the actual key bytes for security
    });
    
    console.log(`\n[Debug] Step 2: Building approval transaction...`);
    const txBytes = await buildApprovalTransaction(
      LISTING_ID,
      RECEIPT_ID,
      agentAddress,
      onChainPolicyId
    );
    console.log(`[Debug] ✅ Approval transaction built (${txBytes.length} bytes)`);
    
    console.log(`\n[Debug] Step 3: Calling Seal decrypt...`);
    console.log(`[Debug] This will contact Seal threshold servers over the network.`);
    
    const decrypted = await sealDecrypt(rawBytes, sessionKey, txBytes);
    
    console.log(`\n[Debug] ========================================`);
    console.log(`[Debug] ✅ DECRYPTION SUCCEEDED!`);
    console.log(`[Debug] ========================================`);
    console.log(`[Debug] Decrypted content length: ${decrypted.length} chars`);
    console.log(`[Debug] Decrypted content preview (first 200 chars):`);
    console.log(decrypted.substring(0, 200));
    
  } catch (err) {
    console.error(`\n[Debug] ========================================`);
    console.error(`[Debug] ❌ DECRYPTION FAILED`);
    console.error(`[Debug] ========================================`);
    console.error(`[Debug] Error type:`, err instanceof Error ? err.constructor.name : typeof err);
    console.error(`[Debug] Error name:`, err instanceof Error ? err.name : 'N/A');
    console.error(`[Debug] Error message:`, err instanceof Error ? err.message : String(err));
    console.error(`\n[Debug] Full error stack:`);
    console.error(err instanceof Error ? err.stack : 'No stack trace available');
    console.error(`\n[Debug] Full error object:`);
    console.error(err);
    
    // Check for network/connectivity issues
    if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('ENOTFOUND'))) {
      console.error(`\n[Debug] ⚠️  This looks like a network connectivity issue.`);
      console.error(`[Debug] ⚠️  Seal threshold servers may be unreachable.`);
    }
    
    // Check for policy mismatch
    if (err instanceof Error && err.message.includes('policy')) {
      console.error(`\n[Debug] ⚠️  This looks like a policy ID mismatch.`);
      console.error(`[Debug] ⚠️  Encryption policy ID ≠ Decryption policy ID`);
    }
    
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n[Debug] Script failed with unhandled error:');
  console.error(err);
  process.exit(1);
});
