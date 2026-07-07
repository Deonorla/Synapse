import { env } from '../config/env.ts';
import { sealEncrypt } from '../seal/encrypt.ts';
import { getStorageDriver } from '../walrus/driver.ts';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mocking the manual MemWal relayer functions as the SDK might not fully expose them yet
const mockRelayerDB = new Map<string, { blobId: string, vector: number[] }[]>();

async function generateEmbedding(text: string): Promise<number[]> {
  if (env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (e) {
      console.warn('[Embeddings] Gemini failed, using fallback hash vector');
    }
  }
  
  // Fallback: simple deterministic hash vector
  const vector = new Array(768).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash = hash & hash;
  }
  const seed = Math.abs(hash) / 2147483647;
  for (let i = 0; i < 768; i++) {
    vector[i] = Math.sin(seed * (i + 1));
  }
  return vector;
}

/**
 * Executes the full custom encrypted memory pipeline.
 * 1. Generates text embedding using Gemini
 * 2. Encrypts plaintext via Seal (with custom OperatorCap policy)
 * 3. Uploads ciphertext to Walrus
 * 4. Registers blobId and vector with MemWal relayer
 * 
 * @param plaintext The sensitive agent execution log
 */
export async function secureRemember(plaintext: string) {
  // 1. Generate embedding vector locally
  const vector = await generateEmbedding(plaintext);

  // 2. Encrypt locally with Seal and custom Move policy
  // Note: we use a deterministic or unique ID for the manual policy
  // Must be a valid 32-byte hex string (64 characters)
  const policyId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  const encryptedObject = await sealEncrypt(plaintext, policyId);

  // 3. Upload to Walrus
  const driver = getStorageDriver(env.STORAGE_DRIVER);
  const blobIds = await driver.uploadBatch([encryptedObject]);
  const blobId = blobIds[0];

  // 4. Register with MemWal Relayer (mocked for now)
  const namespace = 'synapse-agent-secure';
  const entries = mockRelayerDB.get(namespace) || [];
  entries.push({ blobId, vector });
  mockRelayerDB.set(namespace, entries);
  
  console.log(`[MemWal:Manual] Secured memory in blob ${blobId}`);
  return blobId;
}

/**
 * Recalls memory blobs matching a query.
 * Note: Decryption happens separately after this step.
 * 
 * @param query The semantic search query
 * @param topK Number of results
 */
export async function secureRecallIds(query: string, topK: number = 5): Promise<string[]> {
  const queryVector = await generateEmbedding(query);
  
  // For the mock, just return all blobs in the namespace
  const namespace = 'synapse-agent-secure';
  const entries = mockRelayerDB.get(namespace) || [];
  
  // In a real implementation we would compute cosine similarity. 
  // Here we just return the most recent ones.
  return entries.slice(-topK).map(e => e.blobId);
}
