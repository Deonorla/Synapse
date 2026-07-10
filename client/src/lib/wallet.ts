import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const DB_NAME = 'synapse-wallet';
const DB_VERSION = 1;
const STORE_NAME = 'keypairs';
const KEYPAIR_KEY = 'user-keypair';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate a new Ed25519 keypair and store it in IndexedDB.
 * Returns the keypair and its address.
 */
export async function generateAndStoreKeypair(): Promise<Ed25519Keypair> {
  const keypair = Ed25519Keypair.generate();
  const secretKey = keypair.getSecretKey(); // base64 string

  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(secretKey, KEYPAIR_KEY);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(keypair); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Load an existing keypair from IndexedDB.
 * Returns null if no keypair is stored.
 */
export async function loadKeypair(): Promise<Ed25519Keypair | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).get(KEYPAIR_KEY);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      db.close();
      if (!request.result) return resolve(null);
      try {
        const keypair = Ed25519Keypair.fromSecretKey(request.result);
        resolve(keypair);
      } catch {
        resolve(null);
      }
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

/**
 * Get or create a keypair for the current user.
 * If a keypair exists in IndexedDB, load it.
 * Otherwise, generate a new one and store it.
 */
export async function getOrCreateKeypair(): Promise<Ed25519Keypair> {
  const existing = await loadKeypair();
  if (existing) return existing;
  return generateAndStoreKeypair();
}

/**
 * Clear the stored keypair from IndexedDB.
 */
export async function clearKeypair(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(KEYPAIR_KEY);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
