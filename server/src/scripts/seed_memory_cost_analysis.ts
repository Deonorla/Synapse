#!/usr/bin/env tsx
/**
 * Seed listing: Agent Memory Cost Optimization Study
 * Centerpiece dataset #3 with specific, quotable findings
 */
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  console.log('Creating: Agent Memory Cost Optimization Study\n');
  
  // Specific, quotable content with proprietary feel
  const content = `PROPRIETARY ANALYSIS — Synapse Labs Memory Economics Team

Access: Licensed Users Only. Data collected from 2,840 agent-hours of continuous operation across 23 production deployments, March 15 - June 10, 2026.

Study Objective: Quantify the cost-efficiency tradeoffs between memory retrieval frequency, storage backend selection, and decision quality for autonomous agents operating with persistent memory systems.

Methodology: Instrumented production agents with cost tracking across three memory operations: encoding (write), retrieval (read), and consolidation (background maintenance). Measured against decision outcome quality using a standardized benchmark.

Key Findings:

1. Memory Retrieval Frequency vs. Cost

Agents retrieving memories on every decision cycle (100% retrieval rate) incurred average operational costs of $47.30 per 1,000 decisions. Agents using selective retrieval (only when decision uncertainty exceeded 0.6 threshold) reduced costs to $8.20 per 1,000 decisions—an 83% reduction—with only a 4% decrease in decision quality score.

2. Storage Backend Economics

Cost per 10,000 memory entries (1-year storage):
- Centralized vector DB (Pinecone): $142/year
- Decentralized storage (Walrus + MemWal): $23/year
- Self-hosted (Chroma on VPS): $67/year

Decentralized storage delivered 84% cost savings versus managed services, with comparable retrieval latency (median 340ms vs 280ms).

3. Embedding Model Selection Impact

Agents using large embedding models (OpenAI text-embedding-3-large, 3072 dimensions) cost $0.13 per 1,000 memories encoded. Agents using smaller models (text-embedding-3-small, 1536 dimensions) cost $0.02 per 1,000 memories—an 85% reduction—with retrieval precision dropping from 78% to 71% (7 percentage point degradation).

4. Consolidation Frequency Optimization

Weekly memory consolidation (clustering and summarization) reduced storage requirements by 40% on average, at a one-time processing cost of $1.80 per 10,000 memories. Agents without consolidation exceeded storage budgets 3.2x faster, triggering expensive emergency cleanup operations ($12-18 per incident).

5. Decision Quality vs. Memory Budget

Agents operating with memory budgets above 5,000 entries showed diminishing returns: increasing storage from 5,000 to 50,000 entries improved decision quality by only 2.3%, while increasing costs by 890%.

Quantified Recommendations:

For autonomous agents operating under cost constraints:

1. Implement selective retrieval with uncertainty threshold of 0.65 (saves 80%+ on retrieval costs, <5% quality impact).

2. Use decentralized storage (Walrus/MemWal) for persistence: $23/year per 10k entries vs $142/year for managed alternatives.

3. Deploy text-embedding-3-small (1536-dim) instead of large models: 85% cost reduction, 7pp precision tradeoff is acceptable for most use cases.

4. Schedule weekly consolidation jobs: 40% storage reduction pays for itself within 3 weeks for agents storing >1,000 memories/week.

5. Cap memory budgets at 5,000 entries per agent: quality gains beyond this threshold do not justify 9x cost increase.

Cost Model Summary:

A production agent making 10,000 decisions per month with optimized memory configuration:
- Retrieval: $82/month (selective, threshold=0.65)
- Encoding: $20/month (small embeddings)
- Storage: $2/month (decentralized)
- Consolidation: $7/month (weekly)
Total: $111/month operational cost

Same agent without optimization: $473/month (4.3x higher).

Compliance: Data includes anonymized telemetry from licensed Synapse agent deployments. Individual deployment identifiers have been removed per data governance policy.`;
  
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
      title: 'Agent Memory Cost Optimization Study — Production Economics Analysis',
      description: 'Proprietary analysis from 2,840 agent-hours across 23 deployments. Retrieval frequency tradeoffs, storage backend economics, embedding model costs, consolidation ROI. Quantified recommendations with cost models. 20-epoch storage.',
    },
    16_000_000 // 0.016 SUI
  );
  
  console.log('\n✅ CENTERPIECE LISTING #3 CREATED!');
  console.log(`   Listing ID: ${listingId}`);
  console.log(`   Blob ID: ${uploadResult.blobId}`);
  console.log(`   Policy ID: ${policyId}`);
  console.log(`   Price: 0.016 SUI`);
  console.log('\nKey quotable findings embedded:');
  console.log('   • 100% retrieval rate: $47.30 per 1,000 decisions');
  console.log('   • Selective retrieval (threshold 0.6): $8.20 per 1,000 (83% savings, 4% quality drop)');
  console.log('   • Decentralized storage: $23/year per 10k entries vs $142 for Pinecone (84% savings)');
  console.log('   • Large embeddings: $0.13 per 1k memories, Small: $0.02 per 1k (85% savings, 7pp precision drop)');
  console.log('   • Weekly consolidation: 40% storage reduction, pays for itself in 3 weeks');
  console.log('   • Memory cap at 5,000 entries: quality gains beyond this are only 2.3% despite 9x cost');
  console.log('   • Optimized agent: $111/month operational cost');
  console.log('   • Unoptimized agent: $473/month (4.3x higher)');
  console.log('   • Recommendation: Selective retrieval with uncertainty threshold 0.65');
  console.log('   • Recommendation: Use text-embedding-3-small (1536-dim)');
  console.log('   • Recommendation: Cap memory at 5,000 entries per agent');
  console.log('\n✓ Ready for demo (DO NOT PURCHASE YET)');
}

main().catch(console.error);
