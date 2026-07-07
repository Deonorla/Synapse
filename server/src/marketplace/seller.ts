import { env } from '../config/env.ts';
import { Transaction } from '@mysten/sui/transactions';
import { suiClient, keypair } from '../config/sui.ts';
import { ListingMetadata } from './types.ts';
import { bcs } from '@mysten/sui/bcs';

export async function listDataset(blobIds: string[], policyId: string, metadata: ListingMetadata, priceInMist: number): Promise<string> {
  const blobIdBytes = blobIds.map(id => Array.from(new TextEncoder().encode(id)));

  // Register on-chain
  const tx = new Transaction();
  const cleanPolicyId = policyId.replace('0x', '');
  if (!/^[0-9a-fA-F]+$/.test(cleanPolicyId)) {
    throw new Error(`policyId must be a hex string, got: ${policyId}`);
  }
  const policyBytes = Buffer.from(cleanPolicyId, 'hex');

  // Convert blob IDs to a nested vector format expected by Move
  const blobIdsArg = tx.pure(
    bcs.vector(bcs.vector(bcs.u8())).serialize(blobIdBytes).toBytes()
  );

  tx.moveCall({
    target: `${env.SYNAPSE_PACKAGE_ID}::marketplace::list_dataset`,
    arguments: [
      tx.pure.string(metadata.title),
      tx.pure.string(metadata.description),
      tx.pure.u64(priceInMist),
      blobIdsArg,
      tx.pure.u64(blobIds.length),
      tx.pure.vector('u8', policyBytes),
      tx.object('0x6'), // Clock object
    ]
  });

  const { digest } = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair
  });

  const res = await suiClient.waitForTransaction({
    digest,
    options: {
      showEffects: true,
      showEvents: true
    }
  });

  const event = res.events?.find((e: any) => e.type.includes('DatasetListed'));
  if (!event) throw new Error("Listing event not found in transaction");
  const listingObjectId = (event as any).parsedJson?.listing_id;

  console.log(`[Seller] Listed dataset on-chain. TX: ${digest}, Listing ID: ${listingObjectId}`);
  return listingObjectId;
}
