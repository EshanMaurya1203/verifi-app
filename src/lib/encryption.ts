import crypto from "crypto";

const ALGORITHM = "aes-256-ctr";
const IV_LENGTH = 16;

/**
 * Encrypts a string using AES-256-CTR.
 * Note: For production, use a unique IV per encryption and store it.
 * This implementation follows the user's provided logic for simplicity.
 */
export function encrypt(text: string): string {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey) throw new Error("ENCRYPTION_SECRET is not defined");

  // We use a fixed IV here as per user prompt, but ideally this should be random and stored.
  const iv = Buffer.alloc(IV_LENGTH, 0); 
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey.padEnd(32).substring(0, 32), iv);
  
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return encrypted.toString("hex");
}

/**
 * Decrypts a hex string back to its original value.
 */
export function decrypt(hash: string): string {
  const secretKey = process.env.ENCRYPTION_SECRET;
  if (!secretKey) throw new Error("ENCRYPTION_SECRET is not defined");

  const iv = Buffer.alloc(IV_LENGTH, 0);
  const decipher = crypto.createDecipheriv(ALGORITHM, secretKey.padEnd(32).substring(0, 32), iv);
  
  const decrypted = Buffer.concat([decipher.update(Buffer.from(hash, "hex")), decipher.final()]);
  return decrypted.toString();
}
