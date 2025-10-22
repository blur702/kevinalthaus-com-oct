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

function timingSafeEqual(a: string, b: string): boolean {
  // Always perform the same preparatory work regardless of input to avoid timing leaks
  let bufA: Buffer;
  let bufB: Buffer;
  try {
    bufA = Buffer.from(a, 'hex');
    bufB = Buffer.from(b, 'hex');
    // crypto.timingSafeEqual enforces equal length and will throw if mismatched
    return cryptoTimingSafeEqual(bufA, bufB);
  } catch {
    // Any error (invalid hex, length mismatch) results in false without leaking timing
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
