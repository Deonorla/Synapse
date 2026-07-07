#!/usr/bin/env tsx
/**
 * Test with mvrName explicitly removed from SessionKey.create() call
 * to rule out present-vs-absent-key serialization difference.
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { env } from '../config/env.ts';
import { suiClient } from '../config/sui.ts';
import { SessionKey } from '@mysten/seal';
import { SealClient } from '@mysten/seal';

const LISTING_ID = '0x1886cf25bc167d85799214cc7a5f60ddf2476e40a4121c126d24beae07521212';
const BLOB_ID = 'ZzasE5zqnFxzFjwPmfdUaf4oBtPCAjRR43h7dWHcIdE';
const RECEIPT_ID = '0x62a5decc22fc2fc91971f04703275b9688943d720da63e8f44e4f18303d8e495';

async function testWithConfig(configName: string, createConfig: any) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${configName}`);
  console.log('='.repeat(60));
  
  // 1. Setup
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
  
  if (!ownerRow) throw new Error('Owner not found');
  
  const walletData = await getAgentWallet(ownerRow.owner_address);
  if (!walletData) throw new Error('Wallet not found');
  
  const { initializeKeypair } = await import('../config/sui.ts');
  const agentKeypair = initializeKeypair(walletData.privateKeyStr);
  const agentAddress = agentKeypair.getPublicKey().toSuiAddress();
  
  // 2. Fetch listing
  const listingObj = await suiClient.getObject({
    id: LISTING_ID,
    options: { showContent: true }
  });
  
  if (listingObj.data?.content?.dataType !== 'moveObject') {
    throw new Error('Listing not found');
  }
  
  const fields = listingObj.data.content.fields as any;
  const onChainPolicyIdBytes = fields.seal_policy_id;
  const onChainPolicyId = Array.isArray(onChainPolicyIdBytes)
    ? onChainPolicyIdBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')
    : String(onChainPolicyIdBytes);
  
  // 3. Fetch encrypted data
  const walrusUrl = `${env.WALRUS_AGGREGATOR_URL}/v1/blobs/${BLOB_ID}`;
  const walrusResponse = await fetch(walrusUrl);
  if (!walrusResponse.ok) throw new Error('Walrus fetch failed');
  const rawBytes = new Uint8Array(await walrusResponse.arrayBuffer());
  
  // 4. Create session key with specified config
  console.log(`[${configName}] Config keys:`, Object.keys(createConfig).join(', '));
  const sessionKey = await SessionKey.create(createConfig);
  
  const certificate = await sessionKey.getCertificate();
  console.log(`[${configName}] Certificate:`);
  console.log(`  - mvr_name value: ${certificate.mvr_name === undefined ? 'undefined' : certificate.mvr_name === null ? 'null' : `"${certificate.mvr_name}"`}`);
  console.log(`  - mvr_name key present in cert: ${'mvr_name' in certificate}`);
  console.log(`  - signature: ${certificate.signature.slice(0, 40)}...`);
  
  // Serialize to see what actually goes over the wire
  const certJSON = JSON.stringify(certificate);
  console.log(`  - JSON serialized length: ${certJSON.length} chars`);
  console.log(`  - JSON contains "mvr_name": ${certJSON.includes('mvr_name')}`);
  
  // 5. Build tx
  const { buildApprovalTransaction } = await import('../seal/session.ts');
  const txBytes = await buildApprovalTransaction(
    LISTING_ID,
    RECEIPT_ID,
    agentAddress,
    onChainPolicyId
  );
  
  // 6. Test with Ruby Nodes
  const rubyClient = new SealClient({
    suiClient,
    serverConfigs: [
      { objectId: '0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2', weight: 1 }
    ]
  });
  
  try {
    const decrypted = await rubyClient.decrypt({
      data: rawBytes,
      sessionKey,
      txBytes,
    });
    
    console.log(`\n[${configName}] ✅ SUCCESS! Decrypted ${decrypted.length} bytes`);
    return { success: true, config: configName };
  } catch (err) {
    console.log(`\n[${configName}] ❌ FAILED: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, config: configName, error: err };
  }
}

async function main() {
  console.log('Testing MVR Name Configuration Variations\n');
  
  // Common config
  const { getAgentWallet } = await import('../db/sqlite.ts');
  const sqlite3 = await import('sqlite3');
  const { open } = await import('sqlite');
  const db = await open({
    filename: '/Users/ola/Documents/Github/Synapse/server/data/agents.db',
    driver: sqlite3.default.Database
  });
  
  const receiptObj = await suiClient.getObject({
    id: RECEIPT_ID,
    options: { showOwner: true }
  });
  const receiptOwner = (receiptObj.data!.owner as any).AddressOwner;
  const ownerRow = await db.get('SELECT owner_address FROM agent_wallets WHERE agent_address = ?', receiptOwner);
  const walletData = await getAgentWallet(ownerRow.owner_address);
  const { initializeKeypair } = await import('../config/sui.ts');
  const agentKeypair = initializeKeypair(walletData!.privateKeyStr);
  const agentAddress = agentKeypair.getPublicKey().toSuiAddress();
  
  const results = [];
  
  // Test 1: WITH mvrName key (even if undefined)
  results.push(await testWithConfig('With mvrName: undefined', {
    address: agentAddress,
    packageId: env.SEAL_PACKAGE_ID,
    ttlMin: 15,
    signer: agentKeypair,
    suiClient,
    mvrName: undefined,
  }));
  
  // Test 2: WITHOUT mvrName key at all
  results.push(await testWithConfig('Without mvrName key', {
    address: agentAddress,
    packageId: env.SEAL_PACKAGE_ID,
    ttlMin: 15,
    signer: agentKeypair,
    suiClient,
    // mvrName not present in object
  }));
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const result of results) {
    console.log(`${result.success ? '✅' : '❌'} ${result.config}`);
  }
}

main().catch(console.error);
