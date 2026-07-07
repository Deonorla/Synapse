export interface IKnowledgeStorage {
  /**
   * Uploads chunks to storage and returns their IDs.
   */
  uploadBatch(chunks: Uint8Array[], onProgress?: (index: number, total: number) => void): Promise<string[]>;

  /**
   * Downloads chunks from storage using their IDs.
   */
  downloadBatch(ids: string[]): Promise<Uint8Array[]>;
}

export class WalrusStorageDriver implements IKnowledgeStorage {
  async uploadBatch(chunks: Uint8Array[], onProgress?: (index: number, total: number) => void): Promise<string[]> {
    const { uploadBatchToWalrus } = await import('./upload.ts');
    return uploadBatchToWalrus(chunks, onProgress);
  }

  async downloadBatch(ids: string[]): Promise<Uint8Array[]> {
    const { downloadBatchFromWalrus } = await import('./download.ts');
    return downloadBatchFromWalrus(ids);
  }
}

export class MockStorageDriver implements IKnowledgeStorage {
  private store = new Map<string, Uint8Array>();

  async uploadBatch(chunks: Uint8Array[], onProgress?: (index: number, total: number) => void): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const id = `mock_blob_${Math.random().toString(36).substring(7)}`;
      this.store.set(id, chunks[i]);
      ids.push(id);
      if (onProgress) onProgress(i + 1, chunks.length);
    }
    return ids;
  }

  async downloadBatch(ids: string[]): Promise<Uint8Array[]> {
    return ids.map(id => {
      const data = this.store.get(id);
      if (!data) throw new Error(`Mock blob not found: ${id}`);
      return data;
    });
  }
}

const mockDriverInstance = new MockStorageDriver();

export function getStorageDriver(type: 'walrus' | 'mock'): IKnowledgeStorage {
  return type === 'walrus' ? new WalrusStorageDriver() : mockDriverInstance;
}
