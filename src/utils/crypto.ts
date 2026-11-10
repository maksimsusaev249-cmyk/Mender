/**
 * Cryptographic helpers using Web Crypto API:
 * - PBKDF2-HMAC-SHA256 (100,000 iterations) + random 16-byte salt for PIN protection
 * - Backward compatibility with legacy SHA-256 hashes
 * - Constant-time string comparison to prevent timing attacks
 */

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_PREFIX = 'pbkdf2_v3$';

export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function legacyHashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${pin}:mender_v2`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(`${pin}:mender_pepper_v3`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${PBKDF2_PREFIX}${hex}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPinHash(
  pin: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!expectedHash || !salt || !pin) return false;
  if (expectedHash.startsWith(PBKDF2_PREFIX)) {
    const computed = await hashPin(pin, salt);
    return constantTimeEqual(computed, expectedHash);
  }
  // Legacy hash fallback
  const computedLegacy = await legacyHashPin(pin, salt);
  return constantTimeEqual(computedLegacy, expectedHash);
}

const PASSWORD_PBKDF2_PREFIX = 'pbkdf2_pwd_v1$';

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(`${password}:mender_pwd_pepper_v1`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${PASSWORD_PBKDF2_PREFIX}${hex}`;
}

export async function verifyPasswordHash(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!expectedHash || !salt || !password) return false;
  const computed = await hashPassword(password, salt);
  return constantTimeEqual(computed, expectedHash);
}

export async function deriveUidFromEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(`mender_email_uid:${normalized}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `usr_${hex.slice(0, 24)}`;
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'id_' + Date.now();
}
