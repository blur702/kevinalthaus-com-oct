import bcrypt from 'bcrypt';
import { createHash, createHmac, timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashSHA256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function hashSHA512(data: string): string {
  return createHash('sha512').update(data).digest('hex');
}

export function hmacSHA256(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function generatePluginSignature(pluginData: Buffer, secret: string): string {
  return createHmac('sha256', secret).update(pluginData).digest('hex');
}

export function verifyPluginSignature(
  pluginData: Buffer,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generatePluginSignature(pluginData, secret);
  return timingSafeEqual(signature, expectedSignature);
}

/**
 * Timing-safe string comparison for hex-encoded values
 * Prevents timing attacks by validating inputs and using fixed-length buffers
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Expected length for SHA256 hex strings (64 hex chars = 32 bytes)
  const EXPECTED_HEX_LENGTH = 64;
  const FIXED_LENGTH = 32; // 32 bytes

  /**
   * Validates hex string format and length without throwing
   * @returns true if valid, false otherwise
   */
  function isValidHex(hexString: string): boolean {
    // Check exact length
    if (hexString.length !== EXPECTED_HEX_LENGTH) {
      return false;
    }
    // Check only valid hex characters
    return /^[0-9a-fA-F]{64}$/.test(hexString);
  }

  /**
   * Converts validated hex string to fixed-length buffer
   * Must only be called after validation passes
   */
  function hexToFixedBuffer(hexString: string): Buffer {
    return Buffer.from(hexString, 'hex');
  }

  // Validate both inputs (same operation on both to preserve timing)
  const aValid = isValidHex(a);
  const bValid = isValidHex(b);

  // If either input is invalid, return false (but still process both)
  if (!aValid || !bValid) {
    // Still create buffers to maintain timing consistency
    const dummyA = Buffer.alloc(FIXED_LENGTH);
    const dummyB = Buffer.alloc(FIXED_LENGTH);
    try {
      cryptoTimingSafeEqual(dummyA, dummyB);
    } catch {
      // Suppress errors
    }
    return false;
  }

  // Both inputs validated - convert to buffers
  const bufA = hexToFixedBuffer(a);
  const bufB = hexToFixedBuffer(b);

  // Perform constant-time comparison on equal-length buffers
  try {
    return cryptoTimingSafeEqual(bufA, bufB);
  } catch {
    // This should never happen since buffers are same length
    return false;
  }
}

export function generateChecksum(content: string | Buffer): string {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  return createHash('sha256').update(buffer).digest('hex');
}

export function verifyChecksum(content: string | Buffer, expectedChecksum: string): boolean {
  const actualChecksum = generateChecksum(content);
  return timingSafeEqual(actualChecksum, expectedChecksum);
}
