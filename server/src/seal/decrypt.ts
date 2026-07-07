import { SessionKey } from '@mysten/seal';
import { sealClient } from '../config/sui.ts';

/**
 * Decrypts data using Seal threshold decryption.
 * @param encryptedData The EncryptedObject data (bytes) fetched from Walrus.
 * @param sessionKey The SessionKey authorized by the operator.
 * @param txBytes The serialized transaction block proving PurchaseReceipt ownership.
 * @returns The decrypted plaintext string.
 */
export async function sealDecrypt(
  encryptedData: Uint8Array,
  sessionKey: SessionKey,
  txBytes: Uint8Array
): Promise<string> {
  try {
    const decryptedData = await sealClient.decrypt({
      data: encryptedData,
      sessionKey,
      txBytes,
    });
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error(`[Seal] Decryption failed (threshold not met or invalid proof):`, error);
    throw error;
  }
}
