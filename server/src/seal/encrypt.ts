import { sealClient, agentAddress } from '../config/sui.ts';
import { env } from '../config/env.ts';
import { bcs } from '@mysten/bcs';

/**
 * Encrypts data using Seal threshold encryption.
 * @param data The plaintext string to encrypt
 * @param listingId The ID of the marketplace listing (used as policy ID)
 * @returns The encrypted bytes as a Uint8Array
 */
export async function sealEncrypt(data: string, listingId: string): Promise<Uint8Array> {
  console.log(`[Seal] Encrypting data for marketplace listing ${listingId}...`);
  
  try {
    const dataBytes = new TextEncoder().encode(data);
    
    // We use the listingId as the unique identity for this dataset's policy
    const { encryptedObject, key } = await sealClient.encrypt({
      kemType: 0, // Secp256r1
      demType: 1, // AES-256-GCM
      threshold: 1, // Require at least 1 key server
      packageId: env.SEAL_PACKAGE_ID,
      id: listingId,
      data: dataBytes
    });

    console.log(`[Seal] Data encrypted successfully`);
    
    // Return the EncryptedObject bytes directly
    return new Uint8Array(encryptedObject);
  } catch (error) {
    console.error(`[Seal] Encryption failed:`, error);
    throw error;
  }
}
