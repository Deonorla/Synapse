export async function uploadToWalrus(data: Uint8Array): Promise<string> {
  const publisherUrl = (import.meta as any).env.VITE_WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space';
  
  const response = await fetch(`${publisherUrl}/v1/blobs?epochs=1`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: data as unknown as BodyInit,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Walrus upload failed: ${response.status} ${response.statusText} - ${text}`);
  }

  const result = await response.json();
  
  if (result.newlyCreated) {
    return result.newlyCreated.blobObject.blobId;
  }
  if (result.alreadyCertified) {
    return result.alreadyCertified.blobId;
  }
  
  throw new Error('Unexpected response format from Walrus');
}
