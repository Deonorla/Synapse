#!/usr/bin/env tsx
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

const datasets = [
  { title: 'Agent Decision Confidence Calibration — Prediction Accuracy Study', desc: 'Behavioral analysis from 1,850 agent decisions. Confidence score reliability, overconfidence detection, calibration techniques for improved risk assessment.', price: 12_000_000,
    content: `BEHAVIORAL RESEARCH — Synapse Agent Psychology Team

Access: R&D Partners. Analysis of 1,850 autonomous agent trading decisions with confidence scores and outcome tracking, February-May 2026.

Calibration Analysis:

1. Overconfidence Bias: Agents stating 90% confidence were correct only 73% of the time (17 percentage point overconfidence). Agents stating 50% confidence were correct 48% of the time (well-calibrated).

2. Confidence-Outcome Correlation: Decisions with stated confidence >85% had 2.3x higher success rate than decisions with confidence <60% (68% vs 29% success).

3. Calibration Technique Effectiveness: Agents using historical accuracy tracking to adjust confidence scores reduced overconfidence bias by 71% (from 17pp to 5pp deviation).

4. Sample Size Impact: Confidence scores based on >100 historical similar decisions were calibrated within 3pp. Scores based on <20 samples deviated by average 14pp.

Recommendations: Implement historical accuracy tracking for confidence calibration (71% bias reduction), require minimum 100 similar historical decisions before trusting confidence scores (3pp vs 14pp deviation), treat confidence >85% as strong signal (2.3x higher success rate), distrust uncalibrated confidence scores (17pp systematic overconfidence).`
  },
  { title: 'Sui Validator Performance Benchmarking — Delegation Optimization Guide', desc: 'Infrastructure analysis from 97 validators over 6 months. Uptime patterns, commission impact on rewards, delegation strategy optimization for maximum APY.', price: 10_000_000,
    content: `NETWORK INFRASTRUCTURE ANALYSIS — Synapse Staking Research

Distribution: Institutional Stakers. Performance tracking of 97 active Sui validators with 15-minute granularity, December 2025 - May 2026.

Validator Performance Metrics:

1. Uptime Distribution: Top-quartile validators maintained 99.94% uptime. Bottom-quartile averaged 97.2% uptime, resulting in 18% lower staking rewards due to missed attestations.

2. Commission Impact: Validators charging 5% commission with 99.9% uptime generated higher net APY (6.8%) than validators charging 2% with 98.5% uptime (6.3%). Optimal commission range: 3-5% for top performers.

3. Delegation Concentration Risk: Validators with >8% network stake experienced 2.4x higher rate of consensus participation timeouts due to increased validation workload.

4. Geographic Distribution: Validators in low-latency regions (Europe, East Asia) had 14% higher consensus participation rate than high-latency regions, translating to 1.2% APY advantage.

Recommendations: Delegate to validators with >99.9% uptime (18% higher rewards), accept 3-5% commission for top performers (net APY optimization), avoid validators with >8% stake (2.4x higher timeout rate), prefer low-latency geographic regions (1.2% APY advantage).`
  },
  { title: 'Flash Loan Attack Pattern Analysis — DeFi Protocol Vulnerability Scan', desc: 'Security research from 43 flash loan exploits across multiple chains. Attack vector classification, vulnerable protocol patterns, defense mechanism effectiveness.', price: 22_000_000,
    content: `CRITICAL THREAT INTELLIGENCE — Synapse Security Research

Classification: Confidential. Forensic analysis of 43 successful flash loan attacks across Ethereum, BSC, Avalanche, and emerging chains including Sui, January 2025 - May 2026. Total value extracted: $127M.

Attack Pattern Taxonomy:

1. Price Oracle Manipulation (56% of attacks, $71M): Attackers borrowed large sums via flash loan, manipulated spot price in low-liquidity pool, exploited oracle reading manipulated price, repaid loan + profit. Average profit per attack: $2.3M.

2. Reentrancy Exploitation (23% of attacks, $29M): Flash loan enabled attacker to meet balance requirements for vulnerable contract call, reentered before state update, drained funds. Average profit: $1.8M.

3. Governance Attack (12% of attacks, $15M): Flash loan used to acquire voting power, passed malicious proposal in single block, executed before community response. Average profit: $2.5M.

4. Liquidation Cascade (9% of attacks, $12M): Flash loan triggered artificial liquidations by manipulating collateral prices, attacker collected liquidation bonuses. Average profit: $1.7M.

Defense Effectiveness:

1. TWAP Oracles: Protocols using 30-minute TWAP prevented 89% of price manipulation attempts (but remained vulnerable to sustained attacks).

2. Reentrancy Guards: Properly implemented guards prevented 100% of tested reentrancy attacks. 67% of exploited protocols had missing or incomplete guards.

3. Timelock Governance: 24-hour timelocks prevented all observed governance attacks at cost of slower proposal execution.

4. Liquidation Delays: 10-minute liquidation delays with price confirmation reduced cascade attacks by 76%.

Recommendations: Implement TWAP oracles with 30-minute window minimum (89% attack prevention), use comprehensive reentrancy guards on all state-changing functions (100% protection), require 24-hour timelocks for governance (complete governance attack prevention), add 10-minute liquidation delays with price confirmation (76% cascade reduction).`
  }
];

async function main() {
  console.log('Creating final 3 datasets (8-10 of 10)...\n');
  for (let i = 0; i < datasets.length; i++) {
    const d = datasets[i];
    console.log(`[${i+8}/10] ${d.title.slice(0, 60)}...`);
    const bytes = new TextEncoder().encode(d.content);
    const policyId = Buffer.from(crypto.randomBytes(32)).toString('hex');
    const { encryptedObject } = await sealClient.encrypt({ kemType: 0, demType: 1, threshold: 1, packageId: env.SYNAPSE_PACKAGE_ID, id: policyId, data: bytes });
    const upload = await uploadToWalrus(new Uint8Array(encryptedObject), 20);
    const listing = await listDataset([upload.blobId], policyId, { title: d.title, description: d.desc }, d.price);
    console.log(`✅ ${listing.slice(0, 20)}... / ${upload.blobId.slice(0, 20)}... / ${(d.price/1e9).toFixed(3)} SUI\n`);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n🎉 All 10 new proprietary datasets created successfully!');
}
main().catch(console.error);
