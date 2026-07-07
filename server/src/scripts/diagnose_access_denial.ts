#!/usr/bin/env tsx
/**
 * Diagnose why seal_approve_purchase denies access for a legitimate purchase
 */
import { suiClient } from '../config/sui.ts';

const CORRECTED_LISTING_ID = '0x6eaa79b79d600029c8ef9baeaeeb833c3a456053f8aa0d3df39d14e26ef90b29';
const RECEIPT_ID = '0x1b0cb20b05273fd07001350a7b13e2b348011cf9b95c31a289a4de42d2bf9b15';

async function main() {
  console.log('='.repeat(70));
  console.log('DIAGNOSING SEAL ACCESS DENIAL');
  console.log('='.repeat(70));
  console.log('\nThe seal_approve_purchase function only checks:');
  console.log('  assert!(receipt.listing_id == object::id(listing), EReceiptMismatch)');
  console.log('\nSo the access denial means either:');
  console.log('1. Receipt listing_id != actual listing ID');
  console.log('2. The dry-run sender doesn\'t own the receipt\n');
  
  // Fetch listing
  console.log('STEP 1: Fetch DatasetListing from chain');
  console.log('-'.repeat(70));
  const listingObj = await suiClient.getObject({
    id: CORRECTED_LISTING_ID,
    options: { showContent: true, showType: true }
  });
  
  if (listingObj.data?.content?.dataType !== 'moveObject') {
    throw new Error('Listing not found');
  }
  
  const listingFields = listingObj.data.content.fields as any;
  console.log(`Listing ID: ${CORRECTED_LISTING_ID}`);
  console.log(`  owner: ${listingFields.owner}`);
  console.log(`  price_mist: ${listingFields.price_mist}`);
  console.log(`  seal_policy_id (hex): ${Buffer.from(listingFields.seal_policy_id).toString('hex')}`);
  console.log(`  is_active: ${listingFields.is_active}`);
  
  // Fetch receipt
  console.log('\nSTEP 2: Fetch PurchaseReceipt from chain');
  console.log('-'.repeat(70));
  const receiptObj = await suiClient.getObject({
    id: RECEIPT_ID,
    options: { showContent: true, showOwner: true, showType: true }
  });
  
  if (!receiptObj.data) {
    throw new Error('Receipt not found!');
  }
  
  if (receiptObj.data.content?.dataType !== 'moveObject') {
    throw new Error('Receipt is not a Move object');
  }
  
  const receiptFields = receiptObj.data.content.fields as any;
  const receiptOwner = receiptObj.data.owner;
  
  console.log(`Receipt ID: ${RECEIPT_ID}`);
  console.log(`  buyer: ${receiptFields.buyer}`);
  console.log(`  listing_id: ${receiptFields.listing_id}`);
  console.log(`  purchased_at: ${receiptFields.purchased_at}`);
  console.log(`  Owner (runtime): ${JSON.stringify(receiptOwner)}`);
  
  // Compare IDs
  console.log('\nSTEP 3: Compare listing_id in receipt vs actual listing ID');
  console.log('-'.repeat(70));
  console.log(`Receipt.listing_id: ${receiptFields.listing_id}`);
  console.log(`Actual listing ID:  ${CORRECTED_LISTING_ID}`);
  console.log(`Match: ${receiptFields.listing_id === CORRECTED_LISTING_ID ? '✅ YES' : '❌ NO'}`);
  
  if (receiptFields.listing_id !== CORRECTED_LISTING_ID) {
    console.log('\n❌ MISMATCH FOUND!');
    console.log('The receipt\'s listing_id field does not match the listing being decrypted.');
    console.log('This will cause seal_approve_purchase to abort with EReceiptMismatch.\n');
  } else {
    console.log('\n✅ IDs match - not the problem');
  }
  
  // Check sender
  console.log('\nSTEP 4: Check buildApprovalTransaction sender setting');
  console.log('-'.repeat(70));
  
  const { buildApprovalTransaction } = await import('../seal/session.ts');
  
  // Read the source to check if tx.setSender is called
  console.log('Checking buildApprovalTransaction source...');
  const buildApprovalSource = buildApprovalTransaction.toString();
  const hasSetsender = buildApprovalSource.includes('setSender');
  console.log(`Calls tx.setSender(): ${hasSetsender ? '✅ YES' : '❌ NO'}`);
  
  if (!hasSetsender) {
    console.log('\n❌ PROBLEM IDENTIFIED!');
    console.log('buildApprovalTransaction does NOT set tx.setSender().');
    console.log('When Seal dry-runs the PTB, it won\'t know who the sender is,');
    console.log('so it can\'t verify the sender owns the PurchaseReceipt.');
  } else {
    console.log('\n✅ Sender is set in PTB');
  }
  
  // Policy ID comparison
  console.log('\nSTEP 5: Policy ID comparison (encryption vs listing)');
  console.log('-'.repeat(70));
  
  const policyIdFromListing = Buffer.from(listingFields.seal_policy_id).toString('hex');
  console.log(`Policy ID from listing: ${policyIdFromListing}`);
  console.log('This is what seal_approve_purchase sees on-chain.');
  console.log('This should match what was used during sealClient.encrypt({ id: ... })');
  
  console.log('\n' + '='.repeat(70));
  console.log('CONCLUSION');
  console.log('='.repeat(70));
  
  if (receiptFields.listing_id !== CORRECTED_LISTING_ID) {
    console.log('\n🎯 Root cause: Receipt listing_id mismatch');
    console.log('Fix: Investigate why the receipt has a different listing_id');
  } else if (hasSetsender) {
    console.log('\n✅ Everything looks correct!');
    console.log('The access denial might be a timing issue (receipt not yet finalized)');
    console.log('or a network issue. Try the decrypt again.');
  } else {
    console.log('\n🎯 Root cause: PTB missing sender');
    console.log('Fix: buildApprovalTransaction must call tx.setSender(buyerAddress)');
    console.log('before building the transaction bytes.');
  }
}

main().catch(console.error);
