import { SessionKey } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import { Keypair } from '@mysten/sui/cryptography';
import { suiClient } from '../config/sui.ts';
import { env } from '../config/env.ts';

/**
 * Creates a short-lived session key for decryption.
 * @param address The address of the user requesting decryption.
 * @param signer The user's keypair to sign the session creation.
 * @returns The initialized SessionKey.
 */
export async function createSessionKey(address: string, signer: Keypair): Promise<SessionKey> {
  // Verify address matches the keypair
  const derivedAddress = signer.getPublicKey().toSuiAddress();
  console.log(`[SessionKey] Creating session key...`);
  console.log(`[SessionKey] Requested address: ${address}`);
  console.log(`[SessionKey] Derived from keypair: ${derivedAddress}`);
  console.log(`[SessionKey] Addresses match: ${address === derivedAddress ? '✅ YES' : '❌ NO - THIS IS THE PROBLEM!'}`);
  console.log(`[SessionKey] Keypair type: ${signer.constructor.name}`);
  console.log(`[SessionKey] Package ID: ${env.SYNAPSE_PACKAGE_ID} (SYNAPSE - matches PTB)`);
  console.log(`[SessionKey] SuiClient network: testnet`);
  
  if (address !== derivedAddress) {
    throw new Error(`Address mismatch: requested ${address} but keypair derives to ${derivedAddress}`);
  }
  
  try {
    // FIX: Use SYNAPSE_PACKAGE_ID to match the package called in buildApprovalTransaction()
    // The Seal key server reconstructs the personal message from the PTB's package ID,
    // so SessionKey must sign with the SAME package ID that's in the PTB moveCall target.
    const sessionKey = await SessionKey.create({
      address,
      packageId: env.SYNAPSE_PACKAGE_ID,  // Changed from SEAL_PACKAGE_ID
      ttlMin: 15,
      signer,
      suiClient,
    });
    
    // STEP 1: Log the personal message that will be signed
    const personalMessage = sessionKey.getPersonalMessage();
    const personalMessageStr = new TextDecoder().decode(personalMessage);
    console.log(`[SessionKey] Personal message that was signed:`);
    console.log(`[SessionKey] "${personalMessageStr}"`);
    console.log(`[SessionKey] Personal message length: ${personalMessage.length} bytes`);
    console.log(`[SessionKey] Personal message hex (first 100 bytes):`, Buffer.from(personalMessage.slice(0, 100)).toString('hex'));
    
    console.log(`[SessionKey] ✅ Session key created successfully`);
    return sessionKey;
  } catch (err) {
    console.error(`[SessionKey] ❌ SessionKey.create() failed:`, err);
    throw err;
  }
}

/**
 * Builds the transaction block that calls the `seal_approve_purchase` Move function.
 * This is signed locally by the buyer agent (not the server hot wallet) to prove
 * they own the PurchaseReceipt for this listing.
 * 
 * @param listingId The Object ID of the DatasetListing being decrypted.
 * @param receiptId The Object ID of the PurchaseReceipt owned by the buyer.
 * @param buyerAddress The address of the buyer agent.
 * @returns Serialized transaction bytes.
 */
export async function buildApprovalTransaction(
  listingId: string, 
  receiptId: string,
  buyerAddress: string,
  sealPolicyId: string
): Promise<Uint8Array> {
  const tx = new Transaction();
  
  // Seal identities are hex strings; the Move approval receives their raw bytes.
  const cleanSealPolicyId = sealPolicyId.replace(/^0x/, '');
  const idBytes =
    /^[0-9a-fA-F]+$/.test(cleanSealPolicyId) && cleanSealPolicyId.length % 2 === 0
      ? Buffer.from(cleanSealPolicyId, 'hex')
      : new TextEncoder().encode(sealPolicyId);
  
  tx.moveCall({
    target: `${env.SYNAPSE_PACKAGE_ID}::marketplace::seal_approve_purchase`,
    arguments: [
      tx.pure.vector('u8', idBytes),
      tx.object(listingId),
      tx.object(receiptId),
    ],
  });

  // Set the sender to the buyer agent, because the PurchaseReceipt is soulbound
  // and the dry-run will fail if the sender isn't the owner.
  tx.setSender(buyerAddress);

  // CRITICAL: Seal requires onlyTransactionKind: true
  // This returns only the PTB logic without gas/sender envelope
  return await tx.build({ client: suiClient, onlyTransactionKind: true });
}
