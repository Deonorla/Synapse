#!/usr/bin/env tsx
/**
 * Inspect the receipt object with different parsing options
 */
import { suiClient } from '../config/sui.ts';

const RECEIPT_ID = '0x1b0cb20b05273fd07001350a7b13e2b348011cf9b95c31a289a4de42d2bf9b15';

async function main() {
  console.log('Inspecting PurchaseReceipt object\n');
  
  const receiptObj = await suiClient.getObject({
    id: RECEIPT_ID,
    options: { 
      showContent: true, 
      showOwner: true, 
      showType: true,
      showBcs: true,
    }
  });
  
  console.log('Full receipt object:');
  console.log(JSON.stringify(receiptObj, null, 2));
  
  if (receiptObj.data?.content?.dataType === 'moveObject') {
    const fields = receiptObj.data.content.fields as any;
    console.log('\nParsed fields:');
    console.log(JSON.stringify(fields, null, 2));
    
    // Check if it's a struct with an 'id' wrapper
    if (fields.id) {
      console.log('\nFields are wrapped in an id object');
      console.log('id:', fields.id);
    }
  }
}

main().catch(console.error);
