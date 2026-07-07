#!/usr/bin/env tsx
/**
 * Seed listing: Agent Execution Risk Calibration - Internal Benchmark
 * Centerpiece dataset for demo with specific, quotable findings
 */
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  console.log('Creating: Agent Execution Risk Calibration - Internal Benchmark\n');
  
  // EXACT content as specified - verbatim, with specific numbers for quotability
  const content = `INTERNAL RESEARCH MEMO — Synapse Labs Risk Engineering

Distribution: Restricted. Compiled from proprietary backtesting infrastructure, not derived from public data sources.

Methodology: 1,140 simulated autonomous-agent trade executions across 6 Sui-based liquidity venues, May 3 - June 2, 2026. Each simulated agent operated with a fixed capital base and was scored on realized slippage, execution latency, and capital efficiency.

Findings:

1. Agents executing trades against pools below $50,000 TVL experienced average realized slippage of 2.8%, versus 0.31% for pools above $2M TVL.

2. Execution latency above 1,400ms correlated with a 4.1x increase in failed-then-retried transactions, primarily due to price movement during the retry window.

3. Agents that split large orders into 3+ smaller transactions reduced realized slippage by 61% relative to single-transaction execution, at the cost of 2.3x more gas spent.

4. Of all observed failure modes, 38% were attributable to stale price quotes older than 800ms at execution time.

Recommendation: Autonomous agents trading on Sui should cap per-trade slippage tolerance at 0.4% for any pool under $250,000 TVL, and should reject price quotes older than 500ms regardless of venue. Order-splitting is only capital-efficient above a $5,000 notional threshold.`;
  
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
  
  // Verify package ID in encrypted object
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
      title: 'Agent Execution Risk Calibration — Internal Benchmark (Not Publicly Released)',
      description: 'Proprietary research from 1,140 simulated agent executions on Sui. Specific slippage thresholds, latency correlations, and trade-splitting efficiency findings. Restricted distribution. 20-epoch storage.',
    },
    18_000_000 // 0.018 SUI
  );
  
  console.log('\n✅ CENTERPIECE LISTING CREATED!');
  console.log(`   Listing ID: ${listingId}`);
  console.log(`   Blob ID: ${uploadResult.blobId}`);
  console.log(`   Policy ID: ${policyId}`);
  console.log(`   Price: 0.018 SUI`);
  console.log('\nKey quotable findings embedded:');
  console.log('   • 2.8% slippage for pools <$50k TVL vs 0.31% for pools >$2M TVL');
  console.log('   • Latency >1,400ms → 4.1x increase in failed transactions');
  console.log('   • Order-splitting reduced slippage by 61% (cost: 2.3x gas)');
  console.log('   • 38% of failures from stale price quotes >800ms');
  console.log('   • Recommendation: 0.4% slippage cap for pools <$250k TVL');
  console.log('   • Recommendation: Reject price quotes >500ms');
  console.log('   • Order-splitting threshold: $5,000 notional');
  console.log('\n✓ Ready for demo recording (DO NOT PURCHASE YET)');
}

main().catch(console.error);
