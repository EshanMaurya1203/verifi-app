import crypto from "crypto";

const ALGORITHM = "aes-256-ctr";
const IV_LENGTH = 16;

/**
 * Encrypts a string using AES-256-CTR with a random IV.
 * Format: ivHex:encryptedHex
 */
export function encrypt(text: string): string {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey) throw new Error("ENCRYPTION_SECRET is not defined");

  const iv = crypto.randomBytes(IV_LENGTH); 
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey.padEnd(32).substring(0, 32), iv);
  
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a string formatted as ivHex:encryptedHex.
 * Falls back to fixed-IV decryption for legacy data.
 */
export function decrypt(hash: string): string {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey) throw new Error("ENCRYPTION_SECRET is not defined");

  if (hash.includes(":")) {
    const parts = hash.split(":");
    if (parts.length !== 2) throw new Error("Malformed encrypted payload");
    
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, secretKey.padEnd(32).substring(0, 32), iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, "hex")), decipher.final()]);
    return decrypted.toString();
  }

  // Legacy fixed-IV decryption
  console.warn("[ENCRYPTION] Legacy format detected unexpectedly");
  const iv = Buffer.alloc(IV_LENGTH, 0);
  const decipher = crypto.createDecipheriv(ALGORITHM, secretKey.padEnd(32).substring(0, 32), iv);
  
  const decrypted = Buffer.concat([decipher.update(Buffer.from(hash, "hex")), decipher.final()]);
  return decrypted.toString();
}
