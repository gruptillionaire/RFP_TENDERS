import crypto from "crypto";

/**
 * TOTP Secret Encryption Module
 *
 * SECURITY CRITICAL:
 * - Uses AES-256-GCM (authenticated encryption) to protect TOTP secrets at rest
 * - Key derivation via scrypt with strong parameters
 * - Random IV/nonce per encryption operation
 * - Auth tag verification prevents tampering
 *
 * CWE References:
 * - CWE-327: Use of Broken/Risky Cryptographic Algorithm (mitigated: using AES-256-GCM)
 * - CWE-329: Not Using Random IV (mitigated: random nonce per operation)
 * - CWE-328: Weak Hashing (mitigated: using scrypt with strong parameters)
 */

// Encryption constants
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const NONCE_LENGTH = 12; // 96 bits (recommended for GCM)
const AUTH_TAG_LENGTH = 16; // 128 bits

// Scrypt parameters (tuned for security)
const SCRYPT_COST = 16384; // N = 2^14 (balance between security and performance)
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELIZATION = 1; // p

// Encryption key for TOTP secrets - MUST be set in production
function getEncryptionKey(): string {
  const key = process.env.TOTP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL: TOTP_ENCRYPTION_KEY or NEXTAUTH_SECRET must be set in production"
      );
    }
    // Only allow fallback in development
    console.warn(
      "WARNING: Using development fallback encryption key. Set TOTP_ENCRYPTION_KEY in production."
    );
    return "dev-only-fallback-key-not-for-production";
  }

  // Validate key entropy (minimum 32 bytes recommended)
  if (key.length < 32 && process.env.NODE_ENV === "production") {
    console.warn(
      "WARNING: TOTP_ENCRYPTION_KEY should be at least 32 characters for adequate entropy"
    );
  }

  return key;
}

// Use a proper salt derived from the key (or use env var)
function getSalt(): string {
  return process.env.TOTP_ENCRYPTION_SALT || "rfp-engine-totp-v2";
}

/**
 * Derives a cryptographic key from the master key using scrypt
 */
function deriveKey(): Buffer {
  return crypto.scryptSync(getEncryptionKey(), getSalt(), KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });
}

/**
 * Encrypts a TOTP secret for secure database storage
 * Uses AES-256-GCM for authenticated encryption
 *
 * Format: nonce:authTag:ciphertext (all hex-encoded)
 */
export function encryptTOTPSecret(secret: string): string {
  const key = deriveKey();
  const nonce = crypto.randomBytes(NONCE_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: nonce:authTag:ciphertext
  return `${nonce.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a TOTP secret from database storage
 * Verifies authentication tag to detect tampering
 */
export function decryptTOTPSecret(encryptedSecret: string): string {
  const parts = encryptedSecret.split(":");

  // Support legacy format (iv:ciphertext) for backward compatibility
  if (parts.length === 2) {
    return decryptLegacyTOTPSecret(encryptedSecret);
  }

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }

  const [nonceHex, authTagHex, ciphertext] = parts;

  if (!nonceHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted secret format: missing components");
  }

  const key = deriveKey();
  const nonce = Buffer.from(nonceHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  // Validate nonce and auth tag lengths
  if (nonce.length !== NONCE_LENGTH) {
    throw new Error("Invalid nonce length");
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8"); // This will throw if auth tag verification fails

  return decrypted;
}

/**
 * Decrypts legacy AES-256-CBC encrypted secrets
 * Used for backward compatibility during migration
 * @deprecated Use encryptTOTPSecret for new secrets
 */
function decryptLegacyTOTPSecret(encryptedSecret: string): string {
  const [ivHex, encrypted] = encryptedSecret.split(":");
  if (!ivHex || !encrypted) {
    throw new Error("Invalid legacy encrypted secret format");
  }

  // Legacy key derivation (without scrypt parameters)
  const legacySalt = process.env.TOTP_ENCRYPTION_SALT || "rfp-engine-totp-v1";
  const key = crypto.scryptSync(getEncryptionKey(), legacySalt, 32);
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Generates cryptographically secure backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hashes a backup code for secure storage
 */
export function hashBackupCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.toUpperCase())
    .digest("hex");
}
