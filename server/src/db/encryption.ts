import crypto from 'crypto';
import { env } from '../config/env.ts';

const ALGORITHM = 'aes-256-gcm';

export interface EncryptedData {
  iv: string;
  encryptedText: string;
  authTag: string;
}

/**
 * Encrypts a plaintext string using the master key.
 */
export function encrypt(text: string): EncryptedData {
  // Ensure the key is exactly 32 bytes (256 bits)
  const masterKey = Buffer.from(env.AGENT_WALLET_ENCRYPTION_KEY.slice(0, 32), 'utf-8');
  
  // Create a 12-byte initialization vector (recommended for GCM)
  const iv = crypto.randomBytes(12);
  
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    iv: iv.toString('hex'),
    encryptedText: encrypted,
    authTag,
  };
}

/**
 * Decrypts an encrypted string using the master key, verifying authenticity.
 */
export function decrypt(encryptedData: EncryptedData): string {
  const masterKey = Buffer.from(env.AGENT_WALLET_ENCRYPTION_KEY.slice(0, 32), 'utf-8');
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    masterKey,
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
