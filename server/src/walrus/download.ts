import { env } from '../config/env.ts';

/**
 * Downloads a blob from Walrus using its Blob ID.
 * @param blobId The string identifier of the blob.
 * @returns The raw byte array of the blob.
 */
export async function downloadFromWalrus(blobId: string, maxRetries: number = 3): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${env.WALRUS_AGGREGATOR_URL}/v1/${blobId}`);

      if (!response.ok) {
        throw new Error(`Walrus download failed: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
    }
  }
  throw new Error(`Failed to download blob ${blobId} after ${maxRetries} attempts`);
}

/**
 * Downloads multiple blobs from Walrus in parallel.
 */
export async function downloadBatchFromWalrus(blobIds: string[]): Promise<Uint8Array[]> {
  const downloadPromises = blobIds.map(id => downloadFromWalrus(id));
  return await Promise.all(downloadPromises);
}
