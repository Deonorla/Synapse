#!/usr/bin/env tsx
/**
 * Seed listing: Blockchain Agent Security Best Practices
 */
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  console.log('Creating: Blockchain Agent Security Best Practices\n');
  
  const content = {
    title: 'Security Best Practices for Autonomous Blockchain Agents',
    category: 'Security & Risk Management',
    threat_model: {
      key_management: [
        'NEVER log private keys, even partially. Use address-only logging.',
        'Store keys encrypted at rest using OS keychain or hardware security modules',
        'Implement key rotation: generate new keypair every 90 days, migrate funds before deactivating old',
        'Use hierarchical deterministic (HD) wallets for multi-agent systems (BIP32/BIP44)',
        'Separate hot wallet (operational, low balance) from cold treasury (high value, manual approval)'
      ],
      transaction_validation: [
        'Dry-run all transactions before signing: verify gas estimate, effects, and recipient addresses',
        'Set explicit gas budgets: never use "auto" in production, prevents drain attacks',
        'Implement transaction value limits: flag transfers >1% portfolio for manual review',
        'Verify contract addresses against known-good registry before interactions',
        'Check for common attack patterns: re-entrancy, front-running, sandwich attacks'
      ],
      prompt_injection_defense: [
        'Treat all external inputs (user queries, fetched content, API responses) as untrusted',
        'Never execute instructions embedded in data payloads without explicit user confirmation',
        'Use structured prompts with clear system/user boundaries (XML tags, JSON schemas)',
        'Implement content signing: verify external knowledge sources with cryptographic signatures',
        'Sandbox evaluation: test market data against historical patterns before trading'
      ],
      access_control: [
        'Principle of least privilege: grant minimum permissions needed for each operation',
        'Time-boxed capabilities: auto-revoke elevated permissions after task completion',
        'Multi-sig for high-value operations: require 2-of-3 approval (agent + owner + guardian)',
        'Rate limiting: max 10 transactions per hour, 100 per day default limits',
        'Circuit breakers: auto-pause after 3 failed transactions or unexpected balance drops'
      ]
    },
    incident_response: {
      detection: [
        'Monitor balance changes: alert on unexpected drops >5%',
        'Track transaction patterns: flag unusual gas usage, new contract interactions',
        'Log all decisions with reasoning traces for forensic analysis',
        'External monitoring: use third-party services (Forta, OpenZeppelin Defender) for redundancy'
      ],
      containment: [
        'Emergency stop: implement pause() function callable by owner or guardian',
        'Automated fund sweep: if compromise detected, immediately transfer assets to recovery address',
        'Revoke active sessions: invalidate all API keys and session tokens',
        'Isolate affected systems: disable network access until investigation complete'
      ],
      recovery: [
        'Restore from last known-good state before compromise',
        'Rotate all credentials (keys, API tokens, passwords)',
        'Review and patch exploited vulnerability before resuming operations',
        'Post-mortem: document attack vector, implement preventive controls'
      ]
    },
    compliance_considerations: [
      'Know Your Transaction (KYT): screen counterparties against OFAC sanctions lists',
      'Geographic restrictions: block interactions from sanctioned jurisdictions if applicable',
      'Audit logging: retain immutable decision logs for minimum 7 years',
      'Privacy: never store PII on-chain, use zero-knowledge proofs or encrypted off-chain storage',
      'Regulatory reporting: implement automated suspicious activity detection and reporting'
    ],
    testing_strategies: [
      'Adversarial testing: red-team exercises attempting prompt injection, key extraction',
      'Chaos engineering: randomly inject failures (network drops, gas spikes) to test resilience',
      'Formal verification: prove critical safety properties (balance non-negative, no unauthorized transfers)',
      'Testnet rehearsals: validate all new logic on testnet with real-value simulations before mainnet'
    ],
    resources: [
      'OWASP Smart Contract Security Top 10',
      'Trail of Bits Building Secure Contracts guide',
      'ConsenSys Smart Contract Best Practices',
      'NIST Cybersecurity Framework for autonomous systems'
    ],
    created: new Date().toISOString()
  };
  
  const dataBytes = new TextEncoder().encode(JSON.stringify(content, null, 2));
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
  console.log('Uploading to Walrus (20 epochs)...');
  const uploadResult = await uploadToWalrus(new Uint8Array(encryptedObject), 20);
  console.log(`✅ Uploaded: ${uploadResult.blobId}`);
  
  console.log('Creating on-chain listing...');
  const listingId = await listDataset(
    [uploadResult.blobId],
    policyId,
    {
      title: 'Blockchain Agent Security Best Practices',
      description: 'Comprehensive security guide for autonomous blockchain agents: key management, transaction validation, prompt injection defense, incident response, and compliance. Essential for production deployments. 20-epoch storage.',
    },
    12_000_000 // 0.012 SUI
  );
  
  console.log('\n✅ Listing Created!');
  console.log(`   Listing ID: ${listingId}`);
  console.log(`   Blob ID: ${uploadResult.blobId}`);
  console.log(`   Price: 0.012 SUI`);
}

main().catch(console.error);
