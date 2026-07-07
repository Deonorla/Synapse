import { env } from '../config/env.ts';

/**
 * Uploads an encrypted blob to Walrus.
 * @param blobData The byte array to upload.
 * @param epochs Storage duration in epochs (default: 1).
 * @returns The resulting Walrus blob ID and Sui Object ID.
 */
export async function uploadToWalrus(blobData: Uint8Array, epochs: number = 1): Promise<{ blobId: string, suiObjectId: string }> {
  // Use the native HTTP REST API for Walrus upload via the publisher URL
  const response = await fetch(`${env.WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${epochs}`, {
    method: 'PUT',
    body: Buffer.from(blobData),
  });

  if (!response.ok) {
    throw new Error(`Walrus upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.newlyCreated) {
    return {
      blobId: result.newlyCreated.blobObject.blobId,
      suiObjectId: result.newlyCreated.blobObject.id,
    };
  } else if (result.alreadyCertified) {
    return {
      blobId: result.alreadyCertified.blobId,
      suiObjectId: result.alreadyCertified.blobObject.id, // Depending on REST response structure
    };
  }
  
  throw new Error('Unexpected response structure from Walrus publisher');
}

/**
 * Uploads multiple chunks to Walrus sequentially and tracks progress.
 */
export async function uploadBatchToWalrus(
  chunks: Uint8Array[], 
  onProgress?: (index: number, total: number) => void
): Promise<string[]> {
  const blobIds: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const { blobId } = await uploadToWalrus(chunks[i]);
    blobIds.push(blobId);
    
    if (onProgress) {
      onProgress(i + 1, chunks.length);
    }
  }
  
  return blobIds;
}
