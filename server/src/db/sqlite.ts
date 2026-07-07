import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { encrypt, decrypt } from './encryption.ts';

let db: Database;

export async function initDB() {
  if (db) return db;

  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = await open({
    filename: path.join(dbDir, 'agents.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS agent_wallets (
      owner_address TEXT PRIMARY KEY,
      agent_address TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at INTEGER DEFAULT (cast(strftime('%s', 'now') as int))
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS cached_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id TEXT,
      tx_digest TEXT,
      blob_id TEXT NOT NULL,
      policy_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price_mist INTEGER NOT NULL,
      seller_address TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (cast(strftime('%s', 'now') as int))
    )
  `);

  await ensureColumn('cached_listings', 'listing_id', 'TEXT');
  await ensureColumn('cached_listings', 'is_active', 'INTEGER DEFAULT 1');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS agent_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_address TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      listing_title TEXT NOT NULL,
      amount_mist INTEGER NOT NULL,
      receipt_id TEXT,
      tx_digest TEXT,
      memory_blob_id TEXT,
      purchased_at INTEGER DEFAULT (cast(strftime('%s', 'now') as int))
    )
  `);

  await ensureColumn('agent_purchases', 'memory_blob_id', 'TEXT');

  console.log(`[DB] Database initialized successfully`);
  return db;
}

async function ensureColumn(tableName: string, columnName: string, definition: string) {
  const columns = await db.all(`PRAGMA table_info(${tableName})`);
  if (!columns.some((column: any) => column.name === columnName)) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export async function saveAgentWallet(ownerAddress: string, agentAddress: string, privateKeyStr: string) {
  const database = await initDB();
  
  // Encrypt the private key securely before saving
  const encryptedData = encrypt(privateKeyStr);

  await database.run(
    `INSERT OR REPLACE INTO agent_wallets (owner_address, agent_address, encrypted_private_key, iv, auth_tag) 
     VALUES (?, ?, ?, ?, ?)`,
    [ownerAddress, agentAddress, encryptedData.encryptedText, encryptedData.iv, encryptedData.authTag]
  );
  
  console.log(`[DB] Saved encrypted wallet for owner: ${ownerAddress}`);
}

export async function getAgentWallet(ownerAddress: string): Promise<{ agentAddress: string; privateKeyStr: string } | null> {
  const database = await initDB();

  const row = await database.get(
    `SELECT agent_address, encrypted_private_key, iv, auth_tag FROM agent_wallets WHERE owner_address = ?`,
    [ownerAddress]
  );

  if (!row) {
    return null;
  }

  // Decrypt the private key
  const privateKeyStr = decrypt({
    encryptedText: row.encrypted_private_key,
    iv: row.iv,
    authTag: row.auth_tag
  });

  return {
    agentAddress: row.agent_address,
    privateKeyStr
  };
}

export async function saveCachedListing(data: {
  listingId?: string;
  txDigest?: string;
  blobId: string;
  policyId: string;
  title: string;
  description: string;
  priceMist: number;
  sellerAddress: string;
  isActive?: boolean;
}) {
  const database = await initDB();
  await database.run(
    `INSERT INTO cached_listings (listing_id, tx_digest, blob_id, policy_id, title, description, price_mist, seller_address, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.listingId || data.txDigest || null,
      data.txDigest || null,
      data.blobId,
      data.policyId,
      data.title,
      data.description,
      data.priceMist,
      data.sellerAddress,
      data.isActive === false ? 0 : 1,
    ]
  );
  console.log(`[DB] Cached listing: "${data.title}" from seller ${data.sellerAddress}`);
}

export async function clearCachedListings() {
  const database = await initDB();
  const result = await database.run(`DELETE FROM cached_listings`);
  console.log(`[DB] Cleared ${result.changes ?? 0} cached listings`);
}

export async function getCachedListings() {
  const database = await initDB();
  const rows = await database.all(
    `SELECT * FROM cached_listings WHERE is_active = 1 ORDER BY created_at DESC`
  );

  return rows.map((row: any) => {
    const listingId = row.listing_id || row.tx_digest || `local_${row.id}`;
    return {
      id: listingId,
      listingId,
      owner: row.seller_address,
      sellerAddress: row.seller_address,
      title: row.title,
      description: row.description,
      priceMist: Number(row.price_mist),
      blobId: row.blob_id,
      blobIds: [row.blob_id],
      chunkCount: 1,
      sealPolicyId: row.policy_id,
      isActive: Boolean(row.is_active),
      createdAt: Number(row.created_at) * 1000,
    };
  });
}

export async function savePurchase(ownerAddress: string, purchase: {
  listingId: string;
  listingTitle: string;
  amountMist: number;
  receiptId?: string;
  txDigest?: string;
  memoryBlobId?: string;
}) {
  const database = await initDB();
  await database.run(
    `INSERT INTO agent_purchases (owner_address, listing_id, listing_title, amount_mist, receipt_id, tx_digest, memory_blob_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      ownerAddress,
      purchase.listingId,
      purchase.listingTitle,
      purchase.amountMist,
      purchase.receiptId || null,
      purchase.txDigest || null,
      purchase.memoryBlobId || null,
    ]
  );
}

export async function hasPurchased(ownerAddress: string, listingId?: string | null) {
  if (!listingId) return false;
  const database = await initDB();
  const row = await database.get(
    `SELECT 1 FROM agent_purchases WHERE owner_address = ? AND listing_id = ? LIMIT 1`,
    [ownerAddress, listingId]
  );
  return Boolean(row);
}

export async function getPurchases(ownerAddress: string) {
  const database = await initDB();
  const wallet = await database.get(
    `SELECT agent_address FROM agent_wallets WHERE owner_address = ?`,
    [ownerAddress]
  );
  const addresses = wallet?.agent_address ? [ownerAddress, wallet.agent_address] : [ownerAddress];
  const placeholders = addresses.map(() => '?').join(', ');
  return database.all(
    `SELECT * FROM agent_purchases WHERE owner_address IN (${placeholders}) ORDER BY purchased_at DESC`,
    addresses
  );
}
