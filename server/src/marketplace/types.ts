export interface DatasetListing {
  id: string; // The object ID on Sui
  listingId?: string;
  owner: string;
  sellerAddress?: string;
  title: string;
  description: string;
  priceMist: number;
  blobId?: string;
  blobIds: string[]; // Walrus blob IDs (hex string or base64)
  chunkCount: number;
  sealPolicyId: string;
  isActive: boolean;
  createdAt: number;
}

export interface AgentLogEvent {
  phase: 'RECALL' | 'EVALUATE' | 'PURCHASE' | 'DOWNLOAD' | 'DECRYPT' | 'SYNTHESIZE' | 'REMEMBER' | 'TICK_COMPLETE';
  status?: string;
  listing?: string;
  decision?: 'BUY' | 'SKIP';
  reason?: string;
  count?: number;
  preview?: string | string[];
  blobId?: string;
  txDigest?: string;
  receiptId?: string;
  memoryBlobId?: string;
  walrusUrl?: string;
  namespace?: string;
  message?: string;
  bytes?: number;
  chars?: number;
  priceMist?: number;
  error?: string;
  memoryContext?: string;
  result?: string;
  memoryStored?: boolean;
  [key: string]: unknown;
}

export interface PurchaseReceipt {
  id: string; // The object ID of the soulbound receipt
  listingId: string;
  buyer: string;
  purchasedAt: number;
}

export interface ListingMetadata {
  title: string;
  description: string;
}
