import { suiClient } from '../config/sui.ts';

export async function verifyPaymentProof(txDigest: string, expectedAmount: number, expectedRecipient: string): Promise<boolean> {
  console.log(`[x402] Verifying payment proof: ${txDigest}`);
  
  try {
    const txBlock = await suiClient.getTransactionBlock({
      digest: txDigest,
      options: {
        showBalanceChanges: true
      }
    });

    if (!txBlock || !txBlock.balanceChanges) {
      console.log(`[x402] Invalid transaction block or missing balance changes`);
      return false;
    }

    // Look for a balance change matching the expected recipient and amount
    const recipientChange = txBlock.balanceChanges.find(
      (change: any) => change.owner && 
               typeof change.owner === 'object' &&
               'AddressOwner' in change.owner &&
               change.owner.AddressOwner === expectedRecipient &&
               BigInt(change.amount) >= BigInt(expectedAmount)
    );

    if (recipientChange) {
      console.log(`[x402] Payment verified successfully on-chain!`);
      return true;
    }

    console.log(`[x402] Verification failed: Expected payment not found in tx`);
    return false;
  } catch (error) {
    console.error(`[x402] Error verifying payment:`, error);
    return false;
  }
}
