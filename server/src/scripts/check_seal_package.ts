#!/usr/bin/env tsx
/**
 * Check if the Seal package ID actually exists on testnet
 */
import { suiClient } from '../config/sui.ts';
import { env } from '../config/env.ts';

async function main() {
  console.log('Verifying Seal Package ID on Testnet\n');
  console.log(`SEAL_PACKAGE_ID: ${env.SEAL_PACKAGE_ID}`);
  console.log(`Network: ${env.SUI_NETWORK}\n`);
  
  try {
    // Try using core.getObject which is what Seal SDK uses
    const result = await suiClient.core.getObject({
      objectId: env.SEAL_PACKAGE_ID
    });
    
    console.log('✅ Package object found!');
    console.log(`Version: ${result.object?.version}`);
    console.log(`Digest: ${result.object?.digest?.slice(0, 20)}...`);
    
    const version = String(result.object?.version);
    if (version === '1') {
      console.log('\n✅ Package is first version (version="1") - Seal SDK requirement met');
    } else {
      console.log(`\n❌ Package version is "${version}", but Seal SDK requires version="1"`);
      console.log('This is likely the root cause!');
    }
    
  } catch (err) {
    console.error('❌ Failed to fetch package:', err instanceof Error ? err.message : String(err));
    console.error('\nThis means the SEAL_PACKAGE_ID does not exist on testnet or is invalid.');
    console.error('You need to use the correct Seal package ID for testnet.');
    console.error('\nOfficial Mysten Seal testnet package (as of SDK 1.2.1):');
    console.error('Check: https://github.com/MystenLabs/seal');
  }
}

main().catch(console.error);
