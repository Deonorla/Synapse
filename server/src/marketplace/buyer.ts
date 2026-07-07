import { getStorageDriver } from '../walrus/driver.ts';
import { env } from '../config/env.ts';
import { Transaction } from '@mysten/sui/transactions';
import { suiClient, keypair, agentAddress } from '../config/sui.ts';
import { getMemWal } from '../config/memwal.ts';
import { sealDecrypt } from '../seal/decrypt.ts';
import { createSessionKey, buildApprovalTransaction } from '../seal/session.ts';
import { DatasetListing } from './types.ts';

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

/**
 * Purchases a dataset on-chain.
 */
export async function purchaseDatasetWithReceipt(
  listing: DatasetListing,
  agentKeypair: Ed25519Keypair
): Promise<{ receiptId: string; txDigest: string }> {
  const agentAddress = agentKeypair.getPublicKey().toSuiAddress();
  
  // Pre-flight balance check to avoid cryptic "No valid gas coins" error
  const balance = await suiClient.getBalance({ owner: agentAddress });
  const totalBalance = BigInt(balance.totalBalance);
  const requiredMist = BigInt(listing.priceMist) + BigInt(10_000_000); // price + ~0.01 SUI gas buffer
  if (totalBalance < requiredMist) {
    throw new Error(
      `Insufficient balance. Agent has ${totalBalance} MIST but needs at least ${requiredMist} MIST ` +
      `(${listing.priceMist} MIST price + gas). Fund the agent wallet: ${agentAddress}`
    );
  }
  
  const tx = new Transaction();
  
  // Split payment coin
  const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(listing.priceMist)]);

  tx.moveCall({
    target: `${env.SYNAPSE_PACKAGE_ID}::marketplace::purchase_dataset`,
    arguments: [
      tx.object(listing.id),
      paymentCoin,
      tx.object('0x6'), // Clock
    ]
  });

  const { digest } = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: agentKeypair
  });

  const res = await suiClient.waitForTransaction({
    digest,
    options: {
      showEffects: true,
      showEvents: true
    }
  });

  console.log(`[Buyer] Purchased dataset ${listing.id}. TX: ${digest}`);

  // Find the PurchaseReceipt ID in the created objects
  // Need to fetch objectChanges to get the type information
  const txDetails = await suiClient.getTransactionBlock({
    digest,
    options: { showObjectChanges: true }
  });
  
  const receiptChange = txDetails.objectChanges?.find(
    (change: any) => 
      change.type === 'created' && 
      change.objectType?.includes('::marketplace::PurchaseReceipt') &&
      change.owner?.AddressOwner === agentAddress
  ) as any;
  
  if (!receiptChange) {
    throw new Error("Purchase receipt not found in tx object changes");
  }
  
  return { receiptId: receiptChange.objectId, txDigest: digest };
}

export async function purchaseDataset(listing: DatasetListing, agentKeypair: Ed25519Keypair): Promise<string> {
  const { receiptId } = await purchaseDatasetWithReceipt(listing, agentKeypair);
  return receiptId;
}

/**
 * Ingests a purchased dataset.
 */
export async function ingestDataset(listing: DatasetListing, receiptId: string, agentKeypair: Ed25519Keypair) {
  const agentAddress = agentKeypair.getPublicKey().toSuiAddress();
  const driver = getStorageDriver(env.STORAGE_DRIVER);
  
  console.log(`[Buyer] Downloading ${listing.blobIds.length} chunks from storage...`);
  const encryptedChunks = await driver.downloadBatch(listing.blobIds);

  console.log(`[Buyer] Creating Seal session key...`);
  const sessionKey = await createSessionKey(agentAddress, agentKeypair);

  console.log(`[Buyer] Building Seal approval PTB using PurchaseReceipt...`);
  const txBytes = await buildApprovalTransaction(listing.id, receiptId, agentAddress, listing.sealPolicyId);

  console.log(`[Buyer] Decrypting chunks...`);
  const plaintextChunks: string[] = [];
  for (const chunk of encryptedChunks) {
    const plaintext = await sealDecrypt(chunk, sessionKey, txBytes);
    plaintextChunks.push(plaintext);
  }

  console.log(`[Buyer] Ingesting knowledge into MemWal...`);
  const memwal = getMemWal(agentAddress);
  for (const text of plaintextChunks) {
    await memwal.remember(text);
  }

  console.log(`[Buyer] Successfully ingested dataset ${listing.id}`);
}
