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
  // Fixed expected byte length for SHA256 (32 bytes)
  const FIXED_LENGTH = 32;

  // Convert both inputs to buffers using hex decoding
  // Buffer.from will produce a buffer whose length is half the hex string length (rounded down)
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');

  const aLenOk = bufA.length === FIXED_LENGTH;
  const bLenOk = bufB.length === FIXED_LENGTH;

  if (!aLenOk || !bLenOk) {
    // Use zeroed buffers of fixed length to maintain constant-time comparison path
    const zeroA = Buffer.alloc(FIXED_LENGTH);
    const zeroB = Buffer.alloc(FIXED_LENGTH);
    try {
      cryptoTimingSafeEqual(zeroA, zeroB);
    } catch {
      // ignore
    }
    return false;
  }

  try {
    return cryptoTimingSafeEqual(bufA, bufB);
  } catch {
    // Should not occur since lengths are fixed and equal
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
