#!/usr/bin/env tsx
/**
 * Seed listing: Autonomous Agent Wallet Security Audit
 * Centerpiece dataset #2 with specific, quotable findings
 */
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  console.log('Creating: Autonomous Agent Wallet Security Audit\n');
  
  // Specific, quotable content with proprietary feel
  const content = `CONFIDENTIAL SECURITY ASSESSMENT — Synapse Labs Red Team

Classification: Internal Use Only. Findings derived from penetration testing against 47 live autonomous agent deployments, April 12 - May 28, 2026.

Scope: Examined key management practices, transaction signing flows, and runtime security posture across agents managing cumulative $2.3M in digital assets.

Executive Summary:

Of 47 audited agent deployments, 19 (40%) exhibited at least one critical vulnerability. The most common attack vector was insufficient gas budget validation, accounting for 58% of identified critical findings.

Critical Findings:

1. Agents that do not enforce maximum gas budgets are vulnerable to balance drain attacks. In controlled testing, a malicious contract triggered gas consumption of 847x the expected amount, draining 94% of an agent's operational balance in a single transaction.

2. 32% of audited agents stored private keys in environment variables without additional encryption at rest. Key extraction via memory dump was successful in 11 of 15 attempts (73% success rate).

3. Agents using deterministic nonce generation without session isolation are vulnerable to signature replay. We successfully replayed 3 captured transaction signatures against different contract targets, bypassing intended access controls.

4. Only 9 of 47 agents (19%) implemented transaction simulation before signing. Agents without pre-flight simulation executed an average of 2.7 unintended state changes per 100 transactions.

Quantified Risk Exposure:

• High severity: Unlimited gas budgets expose agents to balance drain (observed loss: up to 94% of wallet in single tx)
• High severity: Unencrypted key storage enables credential theft (observed success rate: 73%)
• Medium severity: Missing tx simulation results in 2.7% error rate with unintended consequences
• Medium severity: Nonce reuse patterns enable signature replay in 6.4% of tested scenarios

Recommendations:

Autonomous agents operating on mainnet must implement ALL of the following baseline controls:

1. Hard-cap gas budgets at 0.02 SUI per transaction (2x typical maximum for legitimate operations). Reject any transaction exceeding this threshold.

2. Encrypt private keys at rest using OS-native keychain or HSM. Never store raw key material in plaintext environment variables.

3. Simulate all transactions via dry-run before signing. Abort if simulation reveals unexpected object modifications or balance changes exceeding 5% of specified amount.

4. Implement per-session nonce tracking with 15-minute expiration. Invalidate all nonces on agent restart or owner address rotation.

Compliance Note: Agents managing >$50,000 in assets should undergo quarterly external security audits per emerging DAO governance standards.`;
  
  const dataBytes = new TextEncoder().encode(content);
  const policyIdBytes = crypto.randomBytes(32);
  const policyId = Buffer.from(policyIdBytes).toString('hex');
  
  console.log('Encrypting with Seal (SYNAPSE_PACKAGE_ID)...');
  const { encryptedObject } = await sealClient.encrypt({
    kemType: 0,
    demType: 1,
    threshold: 1,
    packageId: env.SYNAPSE_PACKAGE_ID,
    id: policyId,
    data: dataBytes
  });
  
  console.log(`✅ Encrypted ${dataBytes.length} bytes`);
  console.log(`   Encrypted object size: ${encryptedObject.length} bytes`);
  
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
      title: 'Autonomous Agent Wallet Security Audit — Red Team Internal Report',
      description: 'Confidential penetration test results from 47 live agent deployments managing $2.3M. Critical vulnerability rates, attack success metrics, and quantified risk exposure. Internal use only. 20-epoch storage.',
    },
    20_000_000 // 0.02 SUI
  );
  
  console.log('\n✅ CENTERPIECE LISTING #2 CREATED!');
  console.log(`   Listing ID: ${listingId}`);
  console.log(`   Blob ID: ${uploadResult.blobId}`);
  console.log(`   Policy ID: ${policyId}`);
  console.log(`   Price: 0.02 SUI`);
  console.log('\nKey quotable findings embedded:');
  console.log('   • 40% of audited agents had at least one critical vulnerability');
  console.log('   • 58% of critical findings: insufficient gas budget validation');
  console.log('   • Malicious contract consumed 847x expected gas, drained 94% of balance');
  console.log('   • 32% of agents stored keys in plaintext env vars');
  console.log('   • Key extraction via memory dump: 73% success rate (11/15)');
  console.log('   • Only 19% implemented transaction simulation before signing');
  console.log('   • Missing simulation → 2.7% unintended state changes per 100 tx');
  console.log('   • Recommendation: Cap gas at 0.02 SUI per transaction');
  console.log('   • Recommendation: Encrypt keys at rest, never plaintext env vars');
  console.log('   • Recommendation: Simulate all tx, abort if balance change >5% expected');
  console.log('\n✓ Ready for demo (DO NOT PURCHASE YET)');
}

main().catch(console.error);
