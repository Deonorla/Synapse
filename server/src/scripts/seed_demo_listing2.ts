#!/usr/bin/env tsx
/**
 * ⚠️ DEPRECATED - DO NOT USE
 * This script encrypts with SEAL_PACKAGE_ID which does not have the marketplace module.
 * Use seed_corrected_listing.ts instead, which encrypts with SYNAPSE_PACKAGE_ID.
 * Kept for historical reference only.
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { uploadToWalrus } from '../walrus/upload.ts';
import { listDataset } from '../marketplace/seller.ts';
import { env } from '../config/env.ts';
import { sealClient } from '../config/sui.ts';
import crypto from 'crypto';

async function main() {
  const content = {
    title: 'DeFi Trading Strategies - Sui Ecosystem Q2 2026',
    data: [
      'Strategy 1: DeepBook liquidity pool arbitrage on SUI-USDC pairs',
      'Strategy 2: Cetus V2 concentrated liquidity position management',
      'Strategy 3: Cross-DEX order routing for optimal execution',
      'Strategy 4: MEV protection via FlowX atomic swaps',
      'Strategy 5: Automated market-making strategies for new token launches',
      'Risk metrics: Sharpe ratio 2.4, max drawdown 8.3%, win rate 67%',
    ],
    timestamp: new Date().toISOString(),
  };
  
  const dataBytes = new TextEncoder().encode(JSON.stringify(content, null, 2));
  const policyIdBytes = crypto.randomBytes(32);
  const policyId = Buffer.from(policyIdBytes).toString('hex');
  
  const { encryptedObject } = await sealClient.encrypt({
    kemType: 0,
    demType: 1,
    threshold: 1,
    packageId: env.SEAL_PACKAGE_ID,
    id: policyId,
    data: dataBytes
  });
  
  const uploadResult = await uploadToWalrus(new Uint8Array(encryptedObject), 20);
  
  const listingId = await listDataset(
    [uploadResult.blobId],
    policyId,
    {
      title: 'DeFi Trading Strategies - Sui Ecosystem Q2 2026',
      description: 'Proven trading strategies for Sui DeFi protocols including DeepBook, Cetus, and FlowX. Includes risk metrics and execution guidelines. 20-epoch storage.',
    },
    15_000_000 // 0.015 SUI
  );
  
  console.log('\n✅ Listing 2 Created:');
  console.log(`   Listing ID: ${listingId}`);
  console.log(`   Blob ID: ${uploadResult.blobId}`);
  console.log(`   Price: 0.015 SUI`);
}

main().catch(console.error);
