import crypto from "crypto";

const ALGORITHM_GCM = "aes-256-gcm";
const ALGORITHM_CTR = "aes-256-ctr";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM with a random IV.
 * Format: ivHex:encryptedHex:authTagHex
 */
export function encrypt(text: string): string {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey) throw new Error("ENCRYPTION_SECRET is not defined");

  const iv = crypto.randomBytes(IV_LENGTH); 
  const cipher = crypto.createCipheriv(ALGORITHM_GCM, secretKey.padEnd(32).substring(0, 32), iv);
  
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

/**
 * Decrypts a string formatted as ivHex:encryptedHex:authTagHex (GCM)
 * or falls back to legacy CTR formats.
 */
export function decrypt(hash: string): string {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey) throw new Error("ENCRYPTION_SECRET is not defined");

  const parts = hash.split(":");

  if (parts.length === 3) {
    // New AES-256-GCM format: ivHex:encryptedHex:authTagHex
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = parts[1];
    const authTag = Buffer.from(parts[2], "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM_GCM, secretKey.padEnd(32).substring(0, 32), iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, "hex")), decipher.final()]);
    return decrypted.toString();
  }

  if (parts.length === 2) {
    // Legacy AES-256-CTR format: ivHex:encryptedHex
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM_CTR, secretKey.padEnd(32).substring(0, 32), iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, "hex")), decipher.final()]);
    return decrypted.toString();
  }

  // Legacy fixed-IV decryption
  console.warn("[ENCRYPTION] Legacy fixed-IV format detected unexpectedly");
  const iv = Buffer.alloc(IV_LENGTH, 0);
  const decipher = crypto.createDecipheriv(ALGORITHM_CTR, secretKey.padEnd(32).substring(0, 32), iv);
  
  const decrypted = Buffer.concat([decipher.update(Buffer.from(hash, "hex")), decipher.final()]);
  return decrypted.toString();
}
