import { Transaction } from '@mysten/sui/transactions';
import { suiClient, keypair } from '../config/sui.ts';

// Placeholder package ID for your deployed Move contracts
const SYNAPSE_PACKAGE_ID = '0x_placeholder_synapse_package_id';

/**
 * Registers a newly uploaded Walrus blob for lifecycle management on-chain.
 * @param blobId The Blob ID (byte array representation or hex string).
 * @param durationMs How long the blob should be retained (in milliseconds).
 */
export async function registerManagedBlob(blobId: string, durationMs: number): Promise<void> {
  const tx = new Transaction();
  
  // Convert blobId hex string to byte array for Move vector<u8>
  const blobIdBytes = new TextEncoder().encode(blobId);

  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::data_lifecycle::register_blob`,
    arguments: [
      tx.pure.vector('u8', blobIdBytes),
      tx.pure.u64(durationMs),
      tx.object('0x6'), // Sui Clock object
    ],
  });

  await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
  });
}

/**
 * Extends the lifetime of a managed blob on-chain.
 * @param managedBlobObjectId The Sui Object ID of the `ManagedBlob`.
 * @param additionalDurationMs Additional time to retain the blob (in milliseconds).
 */
export async function extendBlobLifetime(managedBlobObjectId: string, additionalDurationMs: number): Promise<void> {
  const tx = new Transaction();

  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::data_lifecycle::extend_lifetime`,
    arguments: [
      tx.object(managedBlobObjectId),
      tx.pure.u64(additionalDurationMs),
    ],
  });

  await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
  });
}

/**
 * Prunes an expired blob via the Move contract.
 * @param managedBlobObjectId The Sui Object ID of the `ManagedBlob`.
 */
export async function pruneExpiredBlob(managedBlobObjectId: string): Promise<void> {
  const tx = new Transaction();

  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::data_lifecycle::prune_expired`,
    arguments: [
      tx.object(managedBlobObjectId),
      tx.object('0x6'), // Sui Clock object
    ],
  });

  await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
  });
}
