#!/usr/bin/env tsx
/**
 * Check Seal package on-chain to verify version and configuration.
 */
import { suiClient } from '../config/sui.ts';
import { env } from '../config/env.ts';

async function main() {
  console.log('Checking Seal Package Configuration\n');
  console.log(`Package ID: ${env.SEAL_PACKAGE_ID}\n`);
  
  const pkg = await suiClient.getObject({
    objectId: env.SEAL_PACKAGE_ID,
    options: { showContent: true, showOwner: true, showType: true }
  });
  
  console.log('Package object details:');
  console.log(`- Version: ${pkg.object?.version}`);
  console.log(`- Digest: ${pkg.object?.digest}`);
  console.log(`- Owner: ${JSON.stringify(pkg.object?.owner)}`);
  
  const version = String(pkg.object?.version);
  console.log(`\n✓ Is first version: ${version === '1'}`);
  
  if (version !== '1') {
    console.log('\n⚠️  WARNING: Seal SDK requires package version to be "1" (first version)');
    console.log('This could be the root cause of the InvalidUserSignatureError!');
  }
  
  // Try to look up MVR name
  console.log('\n---\nChecking for Move Registry (MVR) name...');
  
  // MVR names are stored in a registry - we can't easily query this without
  // the MVR package, but we can check the error message from SessionKey.create
  // which would have thrown if MVR validation failed
  console.log('MVR name lookup would require querying the MVR registry package.');
  console.log('Since SessionKey.create() succeeded, if an MVR name existed and was');
  console.log('wrong, we would have gotten an InvalidMVRNameError instead.\n');
}

main().catch(console.error);
