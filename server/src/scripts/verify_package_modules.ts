#!/usr/bin/env tsx
/**
 * Verify which package actually defines seal_approve_purchase on-chain
 */
import { suiClient } from '../config/sui.ts';
import { env } from '../config/env.ts';

async function inspectPackage(packageId: string, packageName: string) {
  console.log('='.repeat(70));
  console.log(`Inspecting: ${packageName}`);
  console.log(`Package ID: ${packageId}`);
  console.log('='.repeat(70));
  
  try {
    // First, get the package to see what modules exist
    const pkg = await suiClient.getObject({
      objectId: packageId,
      options: { showContent: true }
    });
    
    console.log(`\nPackage version: ${pkg.object?.version}`);
    
    // Try to get module list - we need to try common module names
    const commonModules = ['marketplace', 'seal', 'main'];
    
    for (const moduleName of commonModules) {
      try {
        console.log(`\n--- Module: ${moduleName} ---`);
        const module = await suiClient.getNormalizedMoveModule({
          package: packageId,
          module: moduleName
        });
        
        if (module) {
          console.log(`✅ Module "${moduleName}" exists`);
          
          // Check for seal_approve_purchase function
          const hasSealApprove = 'seal_approve_purchase' in module.exposedFunctions;
          console.log(`  - seal_approve_purchase function: ${hasSealApprove ? '✅ YES' : '❌ NO'}`);
          
          if (hasSealApprove) {
            const fn = module.exposedFunctions.seal_approve_purchase;
            console.log(`    Parameters: ${fn.parameters.length}`);
            console.log(`    Return: ${JSON.stringify(fn.return)}`);
            console.log(`    Visibility: ${fn.visibility}`);
          }
          
          // Check for key struct types
          const hasDatasetListing = 'DatasetListing' in module.structs;
          const hasPurchaseReceipt = 'PurchaseReceipt' in module.structs;
          
          console.log(`  - DatasetListing struct: ${hasDatasetListing ? '✅ YES' : '❌ NO'}`);
          console.log(`  - PurchaseReceipt struct: ${hasPurchaseReceipt ? '✅ YES' : '❌ NO'}`);
          
          // List all exposed functions
          console.log(`  - Exposed functions (${Object.keys(module.exposedFunctions).length}):`);
          for (const fnName of Object.keys(module.exposedFunctions).sort()) {
            console.log(`    * ${fnName}`);
          }
        }
      } catch (err) {
        console.log(`❌ Module "${moduleName}" not found`);
      }
    }
    
  } catch (err) {
    console.error(`\n❌ Error inspecting package:`, err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  console.log('VERIFYING WHICH PACKAGE DEFINES seal_approve_purchase\n');
  
  console.log('Environment variables:');
  console.log(`SYNAPSE_PACKAGE_ID: ${env.SYNAPSE_PACKAGE_ID}`);
  console.log(`SEAL_PACKAGE_ID: ${env.SEAL_PACKAGE_ID}\n`);
  
  // Inspect SYNAPSE package
  await inspectPackage(env.SYNAPSE_PACKAGE_ID, 'SYNAPSE_PACKAGE_ID');
  
  console.log('\n\n');
  
  // Inspect SEAL package
  await inspectPackage(env.SEAL_PACKAGE_ID, 'SEAL_PACKAGE_ID');
  
  console.log('\n\n');
  console.log('='.repeat(70));
  console.log('CONCLUSION');
  console.log('='.repeat(70));
  console.log('\nBased on the on-chain module inspection above:');
  console.log('- Which package has seal_approve_purchase?');
  console.log('- Which package has DatasetListing and PurchaseReceipt?');
  console.log('\nThe fix should align SessionKey.create() and buildApprovalTransaction()');
  console.log('to use the SAME package ID - whichever one actually has these definitions.');
}

main().catch(console.error);
