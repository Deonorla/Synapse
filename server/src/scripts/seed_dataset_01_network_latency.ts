#!/usr/bin/env tsx
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  const content = `CONFIDENTIAL PERFORMANCE ANALYSIS — Synapse Infrastructure Team

Access: Internal Engineering Only. Data collected from 847 validator node telemetry streams across 6 RPC provider networks, April 1 - May 31, 2026.

Study Objective: Quantify latency patterns, identify optimization opportunities, and establish performance baselines for autonomous agent operations on Sui Network.

Key Findings:

1. RPC Endpoint Selection Impact: Agents using geographically-optimized RPC endpoints (selecting closest by latency) achieved 68% faster transaction confirmation times (median 340ms vs 1,060ms for random selection).

2. Consensus Round Latency: 73% of transactions completed in 2 consensus rounds, 19% in 3 rounds, 8% in 4+ rounds. Transactions submitted during high network load (>500 TPS) experienced 2.3x longer confirmation times.

3. Gas Price Dynamics: Setting gas budget to 1.5x the median recent gas price resulted in 94% first-round acceptance rate, versus 61% acceptance for transactions using exact median price.

4. Retry Strategy Efficiency: Exponential backoff with 500ms initial delay and 2x multiplier reduced failed transaction rate by 82% compared to fixed 1-second retry intervals.

5. Batching Threshold: PTBs (Programmable Transaction Blocks) with 5-12 commands showed optimal gas efficiency (0.31 MIST per command), while PTBs >20 commands experienced diminishing returns (0.48 MIST per command).

Quantified Recommendations:

- Use latency-based RPC endpoint selection (68% faster confirmations)
- Set gas budget to 1.5x median (94% first-round acceptance)
- Implement exponential backoff starting at 500ms (82% reduction in failures)
- Optimize PTB size to 5-12 commands (0.31 MIST per command efficiency)
- Monitor network load and delay non-urgent transactions during >500 TPS periods

Compliance: Anonymized validator telemetry. No personally identifiable endpoint data retained.`;

  const dataBytes = new TextEncoder().encode(content);
  const policyIdBytes = crypto.randomBytes(32);
  const policyId = Buffer.from(policyIdBytes).toString('hex');
  
  const { encryptedObject } = await sealClient.encrypt({
    kemType: 0, demType: 1, threshold: 1,
    packageId: env.SYNAPSE_PACKAGE_ID, id: policyId, data: dataBytes
  });
  
  const uploadResult = await uploadToWalrus(new Uint8Array(encryptedObject), 20);
  
  const listingId = await listDataset(
    [uploadResult.blobId], policyId,
    {
      title: 'Sui Network Latency Optimization Study — Q2 2026 Performance Benchmarks',
      description: 'Proprietary network performance analysis from 847 validator nodes. RPC endpoint optimization, consensus latency patterns, and gas efficiency recommendations. 20-epoch storage.',
    },
    14_000_000
  );
  
  console.log(`✅ Listing ${listingId}, Blob ${uploadResult.blobId}, Price 0.014 SUI`);
}

main().catch(console.error);
