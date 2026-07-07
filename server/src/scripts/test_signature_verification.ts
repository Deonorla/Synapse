#!/usr/bin/env tsx
/**
 * TEST 1: Self-verification - Does the signature verify against itself locally?
 * TEST 2: Fresh keypair - Does a brand new keypair behave differently?
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { env } from '../config/env.ts';
import { suiClient } from '../config/sui.ts';
import { SessionKey } from '@mysten/seal';
import { SealClient } from '@mysten/seal';

const LISTING_ID = '0x1886cf25bc167d85799214cc7a5f60ddf2476e40a4121c126d24beae07521212';
const BLOB_ID = 'ZzasE5zqnFxzFjwPmfdUaf4oBtPCAjRR43h7dWHcIdE';
const RECEIPT_ID = '0x62a5decc22fc2fc91971f04703275b9688943d720da63e8f44e4f18303d8e495';

async function test1_SelfVerification() {
  console.log('='.repeat(70));
  console.log('TEST 1: LOCAL SIGNATURE SELF-VERIFICATION');
  console.log('='.repeat(70));
  console.log('Checking if the signature verifies against itself locally...\n');
  
  // Load the REAL agent keypair
  const receiptObj = await suiClient.getObject({
    id: RECEIPT_ID,
    options: { showOwner: true }
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
  
  console.log(`Agent address: ${agentAddress}`);
  console.log(`Keypair type: ${agentKeypair.constructor.name}\n`);
  
  // Create a SessionKey and get the certificate
  console.log('Creating SessionKey...');
  const sessionKey = await SessionKey.create({
    address: agentAddress,
    packageId: env.SEAL_PACKAGE_ID,
    ttlMin: 15,
    signer: agentKeypair,
    suiClient,
  });
  
  // Get the exact personal message that was signed
  const personalMessage = sessionKey.getPersonalMessage();
  const personalMessageStr = new TextDecoder().decode(personalMessage);
  
  console.log(`Personal message (${personalMessage.length} bytes):`);
  console.log(`"${personalMessageStr}"\n`);
  
  // Get the certificate with the signature
  const certificate = await sessionKey.getCertificate();
  const signature = certificate.signature;
  
  console.log(`Signature (${signature.length} chars):`);
  console.log(`${signature.slice(0, 60)}...\n`);
  
  // TEST: Verify the signature locally using the public key
  console.log('Performing local verification...');
  console.log('Calling: agentKeypair.getPublicKey().verifyPersonalMessage(message, signature)\n');
  
  try {
    const publicKey = agentKeypair.getPublicKey();
    const isValid = await publicKey.verifyPersonalMessage(personalMessage, signature);
    
    console.log('='.repeat(70));
    console.log(`RESULT: ${isValid}`);
    console.log('='.repeat(70));
    
    if (isValid === false) {
      console.log('\n❌ SIGNATURE IS CRYPTOGRAPHICALLY INVALID!');
      console.log('The signature does NOT verify against its own matching public key.');
      console.log('\nThis points to keypair corruption - possible causes:');
      console.log('- Public key and secret key derived from different sources');
      console.log('- Keypair object state corrupted during load/storage');
      console.log('- Mismatch in how bech32 key is being decoded');
    } else if (isValid === true) {
      console.log('\n✅ SIGNATURE IS CRYPTOGRAPHICALLY VALID!');
      console.log('The signature correctly verifies against the public key.');
      console.log('\nThis means the problem is elsewhere:');
      console.log('- Server reconstructs a DIFFERENT personal message than what was signed');
      console.log('- Message encoding/format mismatch between client and server');
      console.log('- Intent scope or signature scheme mismatch');
    }
    
    return isValid;
    
  } catch (err) {
    console.log('='.repeat(70));
    console.log('❌ VERIFICATION THREW AN ERROR');
    console.log('='.repeat(70));
    console.error('Error:', err);
    throw err;
  }
}

async function test2_FreshKeypair() {
  console.log('\n\n');
  console.log('='.repeat(70));
  console.log('TEST 2: FRESH KEYPAIR BEHAVIOR');
  console.log('='.repeat(70));
  console.log('Testing with a brand new, never-stored Ed25519Keypair...\n');
  
  // Create a completely fresh keypair
  const freshKeypair = new Ed25519Keypair();
  const freshAddress = freshKeypair.getPublicKey().toSuiAddress();
  
  console.log(`Fresh address: ${freshAddress}`);
  console.log('This address has no purchase receipt, so authorization will fail.');
  console.log('The question is: WHICH error do we get?\n');
  
  // Fetch listing to get policy ID
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
  
  // Fetch encrypted data
  const walrusUrl = `${env.WALRUS_AGGREGATOR_URL}/v1/blobs/${BLOB_ID}`;
  const walrusResponse = await fetch(walrusUrl);
  if (!walrusResponse.ok) throw new Error('Walrus fetch failed');
  const rawBytes = new Uint8Array(await walrusResponse.arrayBuffer());
  
  console.log('Creating SessionKey with fresh keypair...');
  const sessionKey = await SessionKey.create({
    address: freshAddress,
    packageId: env.SEAL_PACKAGE_ID,
    ttlMin: 15,
    signer: freshKeypair,
    suiClient,
  });
  
  const personalMessage = sessionKey.getPersonalMessage();
  const personalMessageStr = new TextDecoder().decode(personalMessage);
  console.log(`Personal message: "${personalMessageStr}"\n`);
  
  // Build approval transaction (will use a fake receipt ID since we don't have one)
  const { buildApprovalTransaction } = await import('../seal/session.ts');
  const txBytes = await buildApprovalTransaction(
    LISTING_ID,
    RECEIPT_ID,  // Using the old receipt ID - will fail auth but that's expected
    freshAddress,
    onChainPolicyId
  );
  
  console.log('Creating SealClient and attempting decrypt...');
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: [
      { objectId: env.SEAL_KEY_SERVER_1, weight: 1 }
    ]
  });
  
  try {
    await sealClient.decrypt({
      data: rawBytes,
      sessionKey,
      txBytes,
    });
    
    console.log('='.repeat(70));
    console.log('⚠️  UNEXPECTED: Decrypt succeeded!');
    console.log('='.repeat(70));
    
  } catch (err) {
    console.log('='.repeat(70));
    console.log(`ERROR TYPE: ${err instanceof Error ? err.constructor.name : typeof err}`);
    console.log('='.repeat(70));
    
    const errorName = err instanceof Error ? err.constructor.name : 'Unknown';
    const errorMsg = err instanceof Error ? err.message : String(err);
    
    console.log(`\nError: ${errorMsg}\n`);
    
    if (errorName === 'InvalidUserSignatureError') {
      console.log('❌ SAME ERROR: InvalidUserSignatureError');
      console.log('Fresh keypair also gets signature rejection.');
      console.log('\nConclusion: The issue is UNIVERSAL/ENVIRONMENTAL, not specific to the');
      console.log('stored agent keypair. Something systematic about how Ed25519Keypair');
      console.log('signs personal messages is incompatible with Seal key servers.\n');
    } else if (errorName === 'NoAccessError') {
      console.log('✅ DIFFERENT ERROR: NoAccessError');
      console.log('Fresh keypair\'s signature was ACCEPTED!');
      console.log('\nConclusion: The signature itself is FINE. The stored agent keypair');
      console.log('has a specific problem (corruption, wrong derivation, etc.).');
      console.log('The signature scheme works in general.\n');
    } else {
      console.log(`⚠️  UNEXPECTED ERROR: ${errorName}`);
      console.log('Got a different error than expected. Details above.\n');
    }
    
    return errorName;
  }
}

async function main() {
  console.log('DECISIVE SIGNATURE DIAGNOSTIC TESTS\n');
  
  try {
    const test1Result = await test1_SelfVerification();
    const test2Result = await test2_FreshKeypair();
    
    console.log('\n\n');
    console.log('='.repeat(70));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(70));
    console.log(`TEST 1 (Self-verification): ${test1Result === true ? 'TRUE ✅' : test1Result === false ? 'FALSE ❌' : 'ERROR'}`);
    console.log(`TEST 2 (Fresh keypair error): ${test2Result}`);
    console.log('='.repeat(70));
    
  } catch (err) {
    console.error('\nTests failed with exception:');
    console.error(err);
    process.exit(1);
  }
}

main();
