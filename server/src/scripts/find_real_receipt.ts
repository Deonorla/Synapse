#!/usr/bin/env tsx
/**
 * Find the actual PurchaseReceipt object from the purchase transaction
 */
import { suiClient } from '../config/sui.ts';

const PURCHASE_TX = '3WK7pzutYyFhCbxr1KrXG2T7LhAJpJrMTuCe1xMFFjMS';
const BUYER_ADDRESS = '0x6a24b5c8677f14248af350e6e2e920d3c5936f44c13b60f7be22c8a89c1fd92d';

async function main() {
  console.log('Finding Real PurchaseReceipt from Transaction\n');
  console.log(`TX Digest: ${PURCHASE_TX}`);
  console.log(`Buyer: ${BUYER_ADDRESS}\n`);
  
  // Fetch transaction details
  const txData = await suiClient.getTransactionBlock({
    digest: PURCHASE_TX,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showInput: true,
    }
  });
  
  console.log('Object Changes:');
  console.log(JSON.stringify(txData.objectChanges, null, 2));
  
  // Find created objects owned by the buyer
  const createdObjects = txData.objectChanges?.filter(
    (change: any) => change.type === 'created'
  ) || [];
  
  console.log(`\n${createdObjects.length} objects created in this transaction:\n`);
  
  for (const obj of createdObjects) {
    const change = obj as any;
    console.log(`Object ID: ${change.objectId}`);
    console.log(`  Type: ${change.objectType}`);
    console.log(`  Owner: ${JSON.stringify(change.owner)}`);
    
    // Check if it's a PurchaseReceipt
    if (change.objectType && change.objectType.includes('PurchaseReceipt')) {
      console.log(`  ✅ THIS IS THE PURCHASE RECEIPT!`);
      
      // Fetch and inspect it
      const receiptObj = await suiClient.getObject({
        id: change.objectId,
        options: { showContent: true, showOwner: true, showType: true }
      });
      
      console.log(`\n  Receipt details:`);
      if (receiptObj.data?.content?.dataType === 'moveObject') {
        const fields = receiptObj.data.content.fields as any;
        console.log(`    buyer: ${fields.buyer}`);
        console.log(`    listing_id: ${fields.listing_id}`);
        console.log(`    purchased_at: ${fields.purchased_at}`);
      }
      
      return change.objectId;
    }
    console.log('');
  }
  
  console.log('❌ No PurchaseReceipt found in transaction!');
  console.log('This means purchase_dataset did not create a receipt as expected.');
}

main().catch(console.error);
