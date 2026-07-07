#!/usr/bin/env tsx
/**
 * Check for package ID mismatch between SessionKey.create() and buildApprovalTransaction()
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { env } from '../config/env.ts';
import { suiClient } from '../config/sui.ts';
import { SessionKey } from '@mysten/seal';
import { fromBase64 } from '@mysten/bcs';

const LISTING_ID = '0x1886cf25bc167d85799214cc7a5f60ddf2476e40a4121c126d24beae07521212';
const RECEIPT_ID = '0x62a5decc22fc2fc91971f04703275b9688943d720da63e8f44e4f18303d8e495';

async function main() {
  console.log('='.repeat(70));
  console.log('PACKAGE ID MISMATCH DIAGNOSTIC');
  console.log('='.repeat(70));
  console.log('\nChecking for mismatch between SessionKey packageId and PTB moveCall target...\n');
  
  // Setup keypair
  const receiptObj = await suiClient.getObject({
    id: RECEIPT_ID,
    options: { showOwner: true }
  });
  
  const receiptOwner = (receiptObj.data!.owner as any).AddressOwner;
  
  const { getAgentWallet } = await import('../db/sqlite.ts');
  const sqlite3 = await import('sqlite3');
  const { open } = await import('sqlite');
  const db = await open({
    filename: '/Users/ola/Documents/Github/Synapse/server/data/agents.db',
    driver: sqlite3.default.Database
  });
  
  const ownerRow = await db.get('SELECT owner_address FROM agent_wallets WHERE agent_address = ?', receiptOwner);
  const walletData = await getAgentWallet(ownerRow.owner_address);
  const { initializeKeypair } = await import('../config/sui.ts');
  const agentKeypair = initializeKeypair(walletData!.privateKeyStr);
  const agentAddress = agentKeypair.getPublicKey().toSuiAddress();
  
  // Get policy ID
  const listingObj = await suiClient.getObject({
    id: LISTING_ID,
    options: { showContent: true }
  });
  const fields = listingObj.data!.content!.fields as any;
  const onChainPolicyIdBytes = fields.seal_policy_id;
  const onChainPolicyId = Array.isArray(onChainPolicyIdBytes)
    ? onChainPolicyIdBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')
    : String(onChainPolicyIdBytes);
  
  console.log('STEP 1: Compare packageId values at source level');
  console.log('-'.repeat(70));
  
  // 1a. SessionKey packageId
  const sessionKeyPackageId = env.SEAL_PACKAGE_ID;
  console.log(`SessionKey.create() packageId:        ${sessionKeyPackageId}`);
  console.log(`  (from env.SEAL_PACKAGE_ID)`);
  
  // 1b. buildApprovalTransaction packageId
  const { buildApprovalTransaction } = await import('../seal/session.ts');
  
  // Check what buildApprovalTransaction actually uses
  console.log(`\nbuildApprovalTransaction() target:    ${env.SYNAPSE_PACKAGE_ID}::marketplace::seal_approve_purchase`);
  console.log(`  (uses env.SYNAPSE_PACKAGE_ID)`);
  
  console.log('\n🚨 POTENTIAL MISMATCH DETECTED! 🚨');
  console.log(`SessionKey uses:  ${sessionKeyPackageId} (SEAL_PACKAGE_ID)`);
  console.log(`PTB moveCall uses: ${env.SYNAPSE_PACKAGE_ID} (SYNAPSE_PACKAGE_ID)`);
  
  const packageIdsMatch = sessionKeyPackageId === env.SYNAPSE_PACKAGE_ID;
  console.log(`\nPackage IDs match: ${packageIdsMatch ? '✅ YES' : '❌ NO'}`);
  
  if (!packageIdsMatch) {
    console.log('\n❌ FOUND THE BUG! ❌');
    console.log('SessionKey is created with SEAL_PACKAGE_ID, but the approval transaction');
    console.log('calls a function on SYNAPSE_PACKAGE_ID. The Seal key server reconstructs');
    console.log('the personal message using the package ID from the PTB, which is DIFFERENT');
    console.log('from the package ID the client used when signing!\n');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('STEP 2: Verify what\'s actually encoded in the PTB bytes');
  console.log('-'.repeat(70));
  
  // Create the actual transaction bytes
  const txBytes = await buildApprovalTransaction(
    LISTING_ID,
    RECEIPT_ID,
    agentAddress,
    onChainPolicyId
  );
  
  console.log(`\nPTB bytes length: ${txBytes.length}`);
  console.log(`First 50 bytes (hex): ${Buffer.from(txBytes.slice(0, 50)).toString('hex')}`);
  
  // Try to decode and inspect the transaction
  // PTB format: first byte is version/kind, then BCS-encoded transaction
  console.log(`\nFirst byte (kind): 0x${txBytes[0].toString(16)}`);
  
  // Look for the package ID in the raw bytes
  // Package IDs in PTB are 32-byte addresses (64 hex chars without 0x prefix)
  const synapsePackageIdClean = env.SYNAPSE_PACKAGE_ID.replace(/^0x/, '');
  const sealPackageIdClean = sessionKeyPackageId.replace(/^0x/, '');
  
  const txBytesHex = Buffer.from(txBytes).toString('hex');
  
  console.log(`\nSearching PTB bytes for package IDs...`);
  console.log(`SYNAPSE_PACKAGE_ID (${synapsePackageIdClean.slice(0, 16)}...): ${txBytesHex.includes(synapsePackageIdClean) ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log(`SEAL_PACKAGE_ID    (${sealPackageIdClean.slice(0, 16)}...): ${txBytesHex.includes(sealPackageIdClean) ? '✅ FOUND' : '❌ NOT FOUND'}`);
  
  if (txBytesHex.includes(synapsePackageIdClean)) {
    console.log('\n✅ PTB contains SYNAPSE_PACKAGE_ID');
    console.log('This confirms the moveCall target is SYNAPSE_PACKAGE_ID');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('STEP 3: Create SessionKey and show what personal message is signed');
  console.log('-'.repeat(70));
  
  const sessionKey = await SessionKey.create({
    address: agentAddress,
    packageId: sessionKeyPackageId,  // Uses SEAL_PACKAGE_ID
    ttlMin: 15,
    signer: agentKeypair,
    suiClient,
  });
  
  const personalMessage = sessionKey.getPersonalMessage();
  const personalMessageStr = new TextDecoder().decode(personalMessage);
  
  console.log(`\nPersonal message signed by client:`);
  console.log(`"${personalMessageStr}"`);
  
  console.log(`\nPersonal message contains:`);
  console.log(`- Package: ${personalMessageStr.includes(sessionKeyPackageId) ? sessionKeyPackageId : 'NOT FOUND'}`);
  
  // Get certificate
  const certificate = await sessionKey.getCertificate();
  console.log(`\nCertificate fields:`);
  console.log(`- user: ${certificate.user}`);
  console.log(`- creation_time: ${certificate.creation_time}`);
  console.log(`- ttl_min: ${certificate.ttl_min}`);
  console.log(`- session_vk: ${certificate.session_vk}`);
  
  console.log('\n' + '='.repeat(70));
  console.log('STEP 4: Timestamp verification');
  console.log('-'.repeat(70));
  
  const creationTimeMs = certificate.creation_time;
  const computedUTC = new Date(creationTimeMs).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  const messageTimestamp = personalMessageStr.match(/from (.*?), session key/)?.[1];
  
  console.log(`\nRaw creation_time: ${creationTimeMs}`);
  console.log(`In personal message: "${messageTimestamp}"`);
  console.log(`Computed UTC string: "${computedUTC}"`);
  console.log(`Timestamps match: ${messageTimestamp === computedUTC ? '✅ YES' : '❌ NO'}`);
  
  console.log('\n' + '='.repeat(70));
  console.log('FINAL DIAGNOSIS');
  console.log('='.repeat(70));
  
  if (!packageIdsMatch) {
    console.log('\n🎯 ROOT CAUSE IDENTIFIED: PACKAGE ID MISMATCH');
    console.log('\nThe bug:');
    console.log('1. SessionKey signs a message referencing SEAL_PACKAGE_ID');
    console.log(`   "${sessionKeyPackageId}"`);
    console.log('2. The PTB calls a function on SYNAPSE_PACKAGE_ID');
    console.log(`   "${env.SYNAPSE_PACKAGE_ID}"`);
    console.log('3. The Seal key server extracts the package ID from the PTB');
    console.log('4. It reconstructs the personal message using SYNAPSE_PACKAGE_ID');
    console.log('5. It tries to verify the signature against this reconstructed message');
    console.log('6. Signature verification fails because the messages are DIFFERENT\n');
    
    console.log('Fix: buildApprovalTransaction() should call seal_approve_purchase on');
    console.log('SEAL_PACKAGE_ID, not SYNAPSE_PACKAGE_ID.\n');
  } else {
    console.log('\n✅ Package IDs match - not the issue');
    console.log('The mismatch must be elsewhere (timestamp format, encoding, etc.)');
  }
}

main().catch(console.error);
