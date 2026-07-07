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
  
  // Try marketplace module directly
  try {
    console.log(`\nAttempting to read module: marketplace`);
    const module = await suiClient.getNormalizedMoveModule({
      package: packageId,
      module: 'marketplace'
    });
    
    console.log(`✅ Module "marketplace" exists!`);
    
    // Check for seal_approve_purchase function
    const exposedFunctions = Object.keys(module.exposedFunctions);
    console.log(`\nExposed functions (${exposedFunctions.length} total):`);
    
    const hasSealApprove = 'seal_approve_purchase' in module.exposedFunctions;
    console.log(`\n🔍 seal_approve_purchase: ${hasSealApprove ? '✅ FOUND' : '❌ NOT FOUND'}`);
    
    if (hasSealApprove) {
      const fn = module.exposedFunctions.seal_approve_purchase;
      console.log(`   - Parameters (${fn.parameters.length}):`);
      fn.parameters.forEach((param, idx) => {
        console.log(`     ${idx + 1}. ${JSON.stringify(param)}`);
      });
      console.log(`   - Return: ${JSON.stringify(fn.return)}`);
      console.log(`   - Visibility: ${fn.visibility}`);
    }
    
    // Check for key struct types
    const structs = Object.keys(module.structs);
    console.log(`\nStructs (${structs.length} total):`);
    
    const hasDatasetListing = 'DatasetListing' in module.structs;
    const hasPurchaseReceipt = 'PurchaseReceipt' in module.structs;
    
    console.log(`🔍 DatasetListing: ${hasDatasetListing ? '✅ FOUND' : '❌ NOT FOUND'}`);
    console.log(`🔍 PurchaseReceipt: ${hasPurchaseReceipt ? '✅ FOUND' : '❌ NOT FOUND'}`);
    
    if (hasDatasetListing) {
      const struct = module.structs.DatasetListing;
      console.log(`   - Fields: ${Object.keys(struct.fields).join(', ')}`);
    }
    
    // List some key functions
    console.log(`\nKey functions found:`);
    const keyFunctions = ['seal_approve_purchase', 'list_dataset', 'purchase_dataset', 'create_purchase_receipt'];
    for (const fnName of keyFunctions) {
      if (fnName in module.exposedFunctions) {
        console.log(`   ✅ ${fnName}`);
      }
    }
    
    return { hasSealApprove, hasDatasetListing, hasPurchaseReceipt, success: true };
    
  } catch (err) {
    console.log(`❌ Failed to read marketplace module`);
    console.log(`   Error: ${err instanceof Error ? err.message : String(err)}`);
    return { hasSealApprove: false, hasDatasetListing: false, hasPurchaseReceipt: false, success: false };
  }
}

async function main() {
  console.log('VERIFYING WHICH PACKAGE DEFINES seal_approve_purchase\n');
  
  console.log('Environment variables:');
  console.log(`SYNAPSE_PACKAGE_ID: ${env.SYNAPSE_PACKAGE_ID}`);
  console.log(`SEAL_PACKAGE_ID: ${env.SEAL_PACKAGE_ID}\n`);
  
  // Inspect SYNAPSE package
  const synapseResult = await inspectPackage(env.SYNAPSE_PACKAGE_ID, 'SYNAPSE_PACKAGE_ID');
  
  console.log('\n\n');
  
  // Inspect SEAL package  
  const sealResult = await inspectPackage(env.SEAL_PACKAGE_ID, 'SEAL_PACKAGE_ID');
  
  console.log('\n\n');
  console.log('='.repeat(70));
  console.log('CONCLUSION');
  console.log('='.repeat(70));
  
  if (synapseResult.success && synapseResult.hasSealApprove) {
    console.log('\n✅ SYNAPSE_PACKAGE_ID has seal_approve_purchase');
    console.log(`   Also has DatasetListing: ${synapseResult.hasDatasetListing ? 'YES' : 'NO'}`);
    console.log(`   Also has PurchaseReceipt: ${synapseResult.hasPurchaseReceipt ? 'YES' : 'NO'}`);
    console.log('\n🎯 FIX: Change SessionKey.create() to use SYNAPSE_PACKAGE_ID');
    console.log('   The PTB is already correct - it calls SYNAPSE_PACKAGE_ID::marketplace::seal_approve_purchase');
    console.log('   SessionKey needs to sign with the SAME package ID that\'s in the PTB.');
  } else if (sealResult.success && sealResult.hasSealApprove) {
    console.log('\n✅ SEAL_PACKAGE_ID has seal_approve_purchase');
    console.log(`   Also has DatasetListing: ${sealResult.hasDatasetListing ? 'YES' : 'NO'}`);
    console.log(`   Also has PurchaseReceipt: ${sealResult.hasPurchaseReceipt ? 'YES' : 'NO'}`);
    console.log('\n🎯 FIX: Change buildApprovalTransaction() to use SEAL_PACKAGE_ID');
    console.log('   SessionKey is already correct - it uses SEAL_PACKAGE_ID');
    console.log('   The PTB needs to call SEAL_PACKAGE_ID::marketplace::seal_approve_purchase instead.');
  } else {
    console.log('\n❌ Could not determine which package has seal_approve_purchase');
    console.log('   Need to investigate further.');
  }
}

main().catch(console.error);
