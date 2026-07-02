import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { CLOCK_OBJECT_ID, MIST_PER_SUI, SYNAPSE_PACKAGE_ID } from './config';
import type { DatasetListing } from './api';

type MoveObjectFields = Record<string, any>;

export type OwnedObjectSummary = {
  id: string;
  type: string;
  fields?: MoveObjectFields;
};

export type ChainDatasetListing = DatasetListing & {
  source: 'contract';
};

export interface ListDatasetParams {
  title: string;
  description: string;
  priceMist: number;
  blobId: string;
  policyIdBytes: Uint8Array;
}

export type ManagedBlob = {
  id: string;
  blobId: string;
  agentId: string;
  createdAt: number;
  expiresAt: number;
};

export type AgentProfile = {
  id: string;
  name: string;
  delegateAddress: string;
  isActive: boolean;
};

export function formatAddress(address?: string | null, size = 6) {
  if (!address) return 'Not connected';
  return `${address.slice(0, size)}...${address.slice(-4)}`;
}

export function formatMist(mist?: number | string | bigint) {
  if (mist === undefined || mist === null) return '-';
  const value = Number(mist) / MIST_PER_SUI;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} SUI`;
}

export function textToBytes(text: string) {
  return Array.from(new TextEncoder().encode(text));
}

function bytesToHex(bytes: number[]) {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeBytes(value: any): string {
  if (Array.isArray(value)) return new TextDecoder().decode(new Uint8Array(value.map(Number)));
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function decodeHexBytes(value: any): string {
  if (Array.isArray(value)) return bytesToHex(value.map(Number));
  if (typeof value === 'string') return value.replace(/^0x/, '');
  return '';
}

function getFields(obj: any): MoveObjectFields | undefined {
  if (obj.data?.content?.dataType !== 'moveObject') return undefined;
  return obj.data.content.fields as MoveObjectFields;
}

export async function getOwnedByType(
  client: any,
  owner: string,
  structType: string
): Promise<OwnedObjectSummary[]> {
  const res = await client.getOwnedObjects({
    owner,
    filter: { StructType: `${SYNAPSE_PACKAGE_ID}::${structType}` },
    options: { showContent: true, showType: true },
  });

  return res.data
    .map((obj: any) => ({
      id: obj.data?.objectId || '',
      type: obj.data?.type || `${SYNAPSE_PACKAGE_ID}::${structType}`,
      fields: getFields(obj),
    }))
    .filter((obj: OwnedObjectSummary) => obj.id);
}

export async function getOwnedCapabilities(client: any, owner: string) {
  const [operatorCaps, accessAdminCaps, agentAdminCaps, marketplaceAdminCaps, receipts] =
    await Promise.all([
      getOwnedByType(client, owner, 'access_control::OperatorCap'),
      getOwnedByType(client, owner, 'access_control::AdminCap'),
      getOwnedByType(client, owner, 'agent_registry::AdminCap'),
      getOwnedByType(client, owner, 'marketplace::MarketplaceAdminCap'),
      getOwnedByType(client, owner, 'marketplace::PurchaseReceipt'),
    ]);

  return { operatorCaps, accessAdminCaps, agentAdminCaps, marketplaceAdminCaps, receipts };
}

export async function getChainListings(client: any): Promise<ChainDatasetListing[]> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${SYNAPSE_PACKAGE_ID}::marketplace::DatasetListed` },
    limit: 50,
    order: 'descending',
  });

  const ids = Array.from(
    new Set(events.data.map((event: any) => (event.parsedJson as any)?.listing_id).filter(Boolean))
  );
  if (!ids.length) return [];

  const objects = await client.multiGetObjects({ ids, options: { showContent: true } });

  return objects
    .map((obj: any) => {
      const fields = getFields(obj);
      if (!obj.data?.objectId || !fields) return null;
      return {
        id: obj.data.objectId,
        listingId: obj.data.objectId,
        owner: fields.owner,
        sellerAddress: fields.owner,
        title: fields.title,
        description: fields.description,
        priceMist: Number(fields.price_mist),
        blobId: (fields.blob_ids || []).map(decodeBytes)[0] || '',
        blobIds: (fields.blob_ids || []).map(decodeBytes),
        chunkCount: Number(fields.chunk_count),
        sealPolicyId: decodeHexBytes(fields.seal_policy_id),
        isActive: Boolean(fields.is_active),
        createdAt: Number(fields.created_at),
        source: 'contract' as const,
      };
    })
    .filter((listing: ChainDatasetListing | null): listing is ChainDatasetListing => Boolean(listing));
}

export async function getAgentProfiles(client: any): Promise<AgentProfile[]> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${SYNAPSE_PACKAGE_ID}::agent_registry::AgentProfile` },
    limit: 1,
  }).catch(() => ({ data: [] as any[] }));

  void events;

  const objects = await client.queryEvents({
    query: { MoveEventType: `${SYNAPSE_PACKAGE_ID}::agent_registry::AgentRegistered` },
    limit: 1,
  }).catch(() => ({ data: [] as any[] }));

  void objects;

  return [];
}

export async function getManagedBlobs(client: any): Promise<ManagedBlob[]> {
  const events = await client.queryEvents({
    query: { MoveEventType: `${SYNAPSE_PACKAGE_ID}::data_lifecycle::BlobRegistered` },
    limit: 50,
    order: 'descending',
  });

  const ids = Array.from(
    new Set(events.data.map((event: any) => (event.parsedJson as any)?.managed_blob_id).filter(Boolean))
  );
  if (!ids.length) return [];

  const objects = await client.multiGetObjects({ ids, options: { showContent: true } });
  return objects
    .map((obj: any) => {
      const fields = getFields(obj);
      if (!obj.data?.objectId || !fields) return null;
      return {
        id: obj.data.objectId,
        blobId: decodeBytes(fields.blob_id),
        agentId: fields.agent_id,
        createdAt: Number(fields.created_at),
        expiresAt: Number(fields.expires_at),
      };
    })
    .filter((blob: ManagedBlob | null): blob is ManagedBlob => Boolean(blob));
}

export function buildRegisterAgentTx(adminCapId: string, name: string, delegateAddress: string): any {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::agent_registry::register_agent`,
    arguments: [tx.object(adminCapId), tx.pure.string(name), tx.pure.address(delegateAddress)],
  });
  return tx;
}

export function buildDeactivateAgentTx(adminCapId: string, profileId: string): any {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::agent_registry::deactivate_agent`,
    arguments: [tx.object(adminCapId), tx.object(profileId)],
  });
  return tx;
}

export function buildMintOperatorCapTx(adminCapId: string, recipient: string): any {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::access_control::mint_operator_cap`,
    arguments: [tx.object(adminCapId), tx.pure.address(recipient)],
  });
  return tx;
}

export function buildRegisterBlobTx(blobId: string, durationMs: number): any {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::data_lifecycle::register_blob`,
    arguments: [tx.pure.vector('u8', textToBytes(blobId)), tx.pure.u64(durationMs), tx.object(CLOCK_OBJECT_ID)],
  });
  return tx;
}

export function buildExtendBlobTx(managedBlobId: string, additionalDurationMs: number): any {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::data_lifecycle::extend_lifetime`,
    arguments: [tx.object(managedBlobId), tx.pure.u64(additionalDurationMs)],
  });
  return tx;
}

export function buildPruneBlobTx(managedBlobId: string): any {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::data_lifecycle::prune_expired`,
    arguments: [tx.object(managedBlobId), tx.object(CLOCK_OBJECT_ID)],
  });
  return tx;
}

export function buildListDatasetTx(params: ListDatasetParams): Transaction {
  const { title, description, priceMist, blobId, policyIdBytes } = params;
  const PACKAGE_ID = import.meta.env.VITE_SYNAPSE_PACKAGE_ID || SYNAPSE_PACKAGE_ID;
  if (!PACKAGE_ID || PACKAGE_ID.includes('placeholder')) {
    throw new Error('VITE_SYNAPSE_PACKAGE_ID is not set. Check client/.env');
  }

  const tx = new Transaction();
  const blobIdBytes = Array.from(new TextEncoder().encode(blobId));
  const blobIdsArg = tx.pure(
    bcs.vector(bcs.vector(bcs.u8())).serialize([blobIdBytes]).toBytes()
  );

  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::list_dataset`,
    arguments: [
      tx.pure.string(title),
      tx.pure.string(description),
      tx.pure.u64(BigInt(priceMist)),
      blobIdsArg,
      tx.pure.u64(1n),
      tx.pure.vector('u8', Array.from(policyIdBytes)),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });
  return tx;
}

export function buildPurchaseDatasetTx(listingId: string, priceMist: number): any {
  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);
  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::marketplace::purchase_dataset`,
    arguments: [tx.object(listingId), payment, tx.object(CLOCK_OBJECT_ID)],
  });
  return tx;
}

export function buildDelistDatasetTx(listingId: string): any {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SYNAPSE_PACKAGE_ID}::marketplace::delist_dataset`,
    arguments: [tx.object(listingId)],
  });
  return tx;
}

export function buildPaymentTx(recipient: string, amountMist: number): any {
  const tx = new Transaction();
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
  tx.transferObjects([payment], tx.pure.address(recipient));
  return tx;
}
