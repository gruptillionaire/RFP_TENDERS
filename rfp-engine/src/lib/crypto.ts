import crypto from "crypto";

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

  return key;
}

// Use a proper salt derived from the key (or use env var)
function getSalt(): string {
  return process.env.TOTP_ENCRYPTION_SALT || "rfp-engine-totp-v1";
}

/**
 * Encrypts a TOTP secret for secure database storage
 */
export function encryptTOTPSecret(secret: string): string {
  const key = crypto.scryptSync(getEncryptionKey(), getSalt(), 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypts a TOTP secret from database storage
 */
export function decryptTOTPSecret(encryptedSecret: string): string {
  const [ivHex, encrypted] = encryptedSecret.split(":");
  if (!ivHex || !encrypted) {
    throw new Error("Invalid encrypted secret format");
  }

  const key = crypto.scryptSync(getEncryptionKey(), getSalt(), 32);
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
