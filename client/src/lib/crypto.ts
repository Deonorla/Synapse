/**
 * Client-Side Cryptographic AES-GCM Encryption Interface
 * Generates standards-compliant browser-level encryption matching
 * decentralized sovereign user requirements.
 */

export async function encryptText(plaintext: string, passcode: string): Promise<string> {
  const enc = new TextEncoder();
  // 16-byte cryptographically secure salt
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  
  const passphraseKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  // 12-byte initialization vector
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(plaintext)
  );
  
  // Pack salt + iv + ciphertext together
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  
  // Convert byte arrays to Base64 safe payload
  let binary = "";
  const len = combined.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

export async function decryptText(base64Payload: string, passcode: string): Promise<string> {
  try {
    const rawString = atob(base64Payload);
    const combined = new Uint8Array(rawString.length);
    for (let i = 0; i < rawString.length; i++) {
      combined[i] = rawString.charCodeAt(i);
    }
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);
    
    const enc = new TextEncoder();
    const passphraseKey = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(passcode),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    
    const key = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      passphraseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error("Browser-side decryption failed: ", e);
    throw new Error("Cryptographic integrity check failed: Incorrect passcode or corrupt payload buffer.");
  }
}
