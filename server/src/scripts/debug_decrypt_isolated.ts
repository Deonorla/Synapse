#!/usr/bin/env tsx
/**
 * Debug script to test each Seal key server individually.
 * Tests if both servers reject or only one.
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { env } from '../config/env.ts';
import { suiClient } from '../config/sui.ts';
import { createSessionKey, buildApprovalTransaction } from '../seal/session.ts';
import { SealClient } from '@mysten/seal';

const LISTING_ID = '0x1886cf25bc167d85799214cc7a5f60ddf2476e40a4121c126d24beae07521212';
const BLOB_ID = 'ZzasE5zqnFxzFjwPmfdUaf4oBtPCAjRR43h7dWHcIdE';
const RECEIPT_ID = '0x62a5decc22fc2fc91971f04703275b9688943d720da63e8f44e4f18303d8e495';

async function testSingleServer(serverObjectId: string, serverName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Key Server: ${serverName}`);
  console.log(`Object ID: ${serverObjectId}`);
  console.log('='.repeat(60));
  
  // Create isolated SealClient with ONLY this server
  const isolatedClient = new SealClient({
    suiClient,
    serverConfigs: [
      { objectId: serverObjectId, weight: 1 }
    ]
  });
  
  // 1. Find agent keypair
  const receiptObj = await suiClient.getObject({
    id: RECEIPT_ID,
    options: { showContent: true, showOwner: true }
  });
  
  if (!receiptObj.data?.owner || !('AddressOwner' in receiptObj.data.owner)) {
    throw new Error('Receipt owner not found');
  }
  
  const receiptOwner = receiptObj.data.owner.AddressOwner;
  
  const { getAgentWallet } = await import('../db/sqlite.ts');
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
  
  const walletData = await getAgentWallet(ownerRow.owner_address);
  if (!walletData) {
    throw new Error(`Wallet data not found for owner ${ownerRow.owner_address}`);
  }
  
  const { initializeKeypair } = await import('../config/sui.ts');
  const agentKeypair = initializeKeypair(walletData.privateKeyStr);
  const agentAddress = agentKeypair.getPublicKey().toSuiAddress();
  
  // 2. Fetch listing to get policy ID
  const listingObj = await suiClient.getObject({
    id: LISTING_ID,
    options: { showContent: true }
  });
  
  if (listingObj.data?.content?.dataType !== 'moveObject') {
    throw new Error('Listing object not found or invalid');
  }
  
  const fields = listingObj.data.content.fields as any;
  const onChainPolicyIdBytes = fields.seal_policy_id;
  const onChainPolicyId = Array.isArray(onChainPolicyIdBytes)
    ? onChainPolicyIdBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')
    : String(onChainPolicyIdBytes);
  
  // 3. Fetch encrypted bytes from Walrus
  const walrusUrl = `${env.WALRUS_AGGREGATOR_URL}/v1/blobs/${BLOB_ID}`;
  const walrusResponse = await fetch(walrusUrl);
  if (!walrusResponse.ok) {
    throw new Error(`Walrus fetch failed: ${walrusResponse.status}`);
  }
  const rawBytes = new Uint8Array(await walrusResponse.arrayBuffer());
  
  // 4. Create session key and approval transaction
  console.log(`\n[${serverName}] Creating session key...`);
  const sessionKey = await createSessionKey(agentAddress, agentKeypair);
  
  console.log(`[${serverName}] Building approval transaction...`);
  const txBytes = await buildApprovalTransaction(
    LISTING_ID,
    RECEIPT_ID,
    agentAddress,
    onChainPolicyId
  );
  
  // 5. Attempt decryption with ISOLATED client
  console.log(`[${serverName}] Attempting decrypt with threshold=1...`);
  try {
    const decrypted = await isolatedClient.decrypt({
      data: rawBytes,
      sessionKey,
      txBytes,
    });
    
    console.log(`\n[${serverName}] ✅ SUCCESS!`);
    console.log(`[${serverName}] Decrypted ${decrypted.length} bytes`);
    console.log(`[${serverName}] Preview:`, new TextDecoder().decode(decrypted.slice(0, 200)));
    return { success: true, server: serverName };
  } catch (err) {
    console.log(`\n[${serverName}] ❌ FAILED`);
    console.log(`[${serverName}] Error type:`, err instanceof Error ? err.constructor.name : typeof err);
    console.log(`[${serverName}] Error message:`, err instanceof Error ? err.message : String(err));
    
    // Check if it has requestId (indicates which server in the response)
    if (err && typeof err === 'object' && 'requestId' in err) {
      console.log(`[${serverName}] Request ID:`, (err as any).requestId);
    }
    
    return { success: false, server: serverName, error: err };
  }
}

async function main() {
  console.log('Testing Seal Key Servers in Isolation');
  console.log('This will test each server independently to identify which one rejects the signature\n');
  
  const results = [];
  
  // Test Server 1
  try {
    const result = await testSingleServer(env.SEAL_KEY_SERVER_1, 'Server 1');
    results.push(result);
  } catch (err) {
    console.error('Server 1 test failed with exception:', err);
    results.push({ success: false, server: 'Server 1', error: err });
  }
  
  // Test Server 2
  try {
    const result = await testSingleServer(env.SEAL_KEY_SERVER_2, 'Server 2');
    results.push(result);
  } catch (err) {
    console.error('Server 2 test failed with exception:', err);
    results.push({ success: false, server: 'Server 2', error: err });
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.server}: SUCCESS`);
    } else {
      const errorMsg = result.error instanceof Error ? result.error.message : String(result.error);
      console.log(`❌ ${result.server}: FAILED - ${errorMsg}`);
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\nResult: ${successCount}/2 servers succeeded`);
  
  if (successCount === 0) {
    console.log('\n⚠️  BOTH servers reject the signature with identical error');
    console.log('This suggests a systematic issue with how the signature is generated/validated');
  } else if (successCount === 1) {
    console.log('\n⚠️  Only ONE server accepts the signature');
    console.log('This suggests a server-specific configuration issue');
  } else {
    console.log('\n✅ BOTH servers accept the signature');
    console.log('The issue may be threshold-specific or aggregation-related');
  }
}

main().catch((err) => {
  console.error('\nScript failed:');
  console.error(err);
  process.exit(1);
});
