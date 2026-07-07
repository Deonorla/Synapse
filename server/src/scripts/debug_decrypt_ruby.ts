#!/usr/bin/env tsx
/**
 * Debug script to test against Ruby Nodes independent key server.
 * This isolates whether the issue is Mysten-testnet-specific or universal.
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { env } from '../config/env.ts';
import { suiClient } from '../config/sui.ts';
import { SessionKey } from '@mysten/seal';
import { SealClient } from '@mysten/seal';

const LISTING_ID = '0x1886cf25bc167d85799214cc7a5f60ddf2476e40a4121c126d24beae07521212';
const BLOB_ID = 'ZzasE5zqnFxzFjwPmfdUaf4oBtPCAjRR43h7dWHcIdE';
const RECEIPT_ID = '0x62a5decc22fc2fc91971f04703275b9688943d720da63e8f44e4f18303d8e495';

// Ruby Nodes independent testnet key server
const RUBY_NODES_SERVER = '0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2';

async function main() {
  console.log('Testing Against Independent Third-Party Key Server');
  console.log('Server: Ruby Nodes (testnet)');
  console.log(`Object ID: ${RUBY_NODES_SERVER}`);
  console.log('URL: https://seal-testnet.api.rubynodes.io\n');
  
  // 1. Find agent keypair
  const receiptObj = await suiClient.getObject({
    id: RECEIPT_ID,
    options: { showContent: true, showOwner: true }
  });
  
  if (!receiptObj.data?.owner || !('AddressOwner' in receiptObj.data.owner)) {
    throw new Error('Receipt owner not found');
  }
  
  const receiptOwner = receiptObj.data.owner.AddressOwner;
  console.log(`[Ruby] Receipt owner: ${receiptOwner}`);
  
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
    throw new Error(`Wallet data not found`);
  }
  
  const { initializeKeypair } = await import('../config/sui.ts');
  const agentKeypair = initializeKeypair(walletData.privateKeyStr);
  const agentAddress = agentKeypair.getPublicKey().toSuiAddress();
  console.log(`[Ruby] Agent address: ${agentAddress}\n`);
  
  // 2. Fetch listing to get policy ID
  const listingObj = await suiClient.getObject({
    id: LISTING_ID,
    options: { showContent: true }
  });
  
  if (listingObj.data?.content?.dataType !== 'moveObject') {
    throw new Error('Listing object not found');
  }
  
  const fields = listingObj.data.content.fields as any;
  const onChainPolicyIdBytes = fields.seal_policy_id;
  const onChainPolicyId = Array.isArray(onChainPolicyIdBytes)
    ? onChainPolicyIdBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')
    : String(onChainPolicyIdBytes);
  
  // 3. Fetch encrypted bytes
  const walrusUrl = `${env.WALRUS_AGGREGATOR_URL}/v1/blobs/${BLOB_ID}`;
  const walrusResponse = await fetch(walrusUrl);
  if (!walrusResponse.ok) {
    throw new Error(`Walrus fetch failed: ${walrusResponse.status}`);
  }
  const rawBytes = new Uint8Array(await walrusResponse.arrayBuffer());
  console.log(`[Ruby] Fetched ${rawBytes.length} bytes from Walrus\n`);
  
  // 4. Create session key WITHOUT mvrName (let it default)
  console.log('[Ruby] Creating session key WITHOUT explicit mvrName...');
  const sessionKey = await SessionKey.create({
    address: agentAddress,
    packageId: env.SEAL_PACKAGE_ID,
    ttlMin: 15,
    signer: agentKeypair,
    suiClient,
  });
  
  const personalMessage = sessionKey.getPersonalMessage();
  const personalMessageStr = new TextDecoder().decode(personalMessage);
  console.log(`[Ruby] Personal message: "${personalMessageStr}"`);
  
  // Check certificate for MVR name
  const certificate = await sessionKey.getCertificate();
  console.log('[Ruby] Certificate structure:');
  console.log(`  - user: ${certificate.user}`);
  console.log(`  - session_vk: ${certificate.session_vk}`);
  console.log(`  - creation_time: ${certificate.creation_time}`);
  console.log(`  - ttl_min: ${certificate.ttl_min}`);
  console.log(`  - signature length: ${certificate.signature.length} chars`);
  console.log(`  - mvr_name: ${certificate.mvr_name === undefined ? 'undefined' : certificate.mvr_name === null ? 'null' : `"${certificate.mvr_name}"`}`);
  console.log(`  - mvr_name key present: ${'mvr_name' in certificate}`);
  
  // 5. Build approval transaction
  console.log('\n[Ruby] Building approval transaction...');
  const { buildApprovalTransaction } = await import('../seal/session.ts');
  const txBytes = await buildApprovalTransaction(
    LISTING_ID,
    RECEIPT_ID,
    agentAddress,
    onChainPolicyId
  );
  console.log(`[Ruby] Transaction built: ${txBytes.length} bytes\n`);
  
  // 6. Create SealClient with ONLY Ruby Nodes server
  console.log('[Ruby] Creating SealClient with Ruby Nodes server only...');
  const rubyClient = new SealClient({
    suiClient,
    serverConfigs: [
      { objectId: RUBY_NODES_SERVER, weight: 1 }
    ]
  });
  
  // 7. Attempt decrypt
  console.log('[Ruby] Attempting decrypt with threshold=1...\n');
  console.log('='.repeat(60));
  try {
    const decrypted = await rubyClient.decrypt({
      data: rawBytes,
      sessionKey,
      txBytes,
    });
    
    console.log('✅✅✅ RUBY NODES SERVER ACCEPTS THE SIGNATURE! ✅✅✅');
    console.log('='.repeat(60));
    console.log(`\n[Ruby] Decrypted ${decrypted.length} bytes successfully`);
    console.log('[Ruby] Preview (first 200 chars):');
    console.log(new TextDecoder().decode(decrypted.slice(0, 200)));
    console.log('\n🎯 CONCLUSION: The signature is CORRECT.');
    console.log('🎯 The problem is specific to Mysten Labs testnet key servers.');
    console.log('🎯 Likely cause: Version skew or configuration mismatch on Mysten\'s deployment.');
    console.log('🎯 Your code is WORKING. The issue is external.\n');
    
  } catch (err) {
    console.log('❌ RUBY NODES SERVER ALSO REJECTS THE SIGNATURE');
    console.log('='.repeat(60));
    console.log(`[Ruby] Error type: ${err instanceof Error ? err.constructor.name : typeof err}`);
    console.log(`[Ruby] Error message: ${err instanceof Error ? err.message : String(err)}`);
    
    if (err && typeof err === 'object' && 'requestId' in err) {
      console.log(`[Ruby] Request ID: ${(err as any).requestId}`);
    }
    
    console.log('\n🔍 CONCLUSION: Signature issue is universal, not Mysten-specific.');
    console.log('🔍 The bug is in how the signature is being produced client-side.');
    console.log('🔍 Need to investigate Ed25519Keypair.signPersonalMessage() behavior.\n');
    
    if (err instanceof Error) {
      console.log('Full error stack:');
      console.log(err.stack);
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Script failed:');
  console.error(err);
  process.exit(1);
});
