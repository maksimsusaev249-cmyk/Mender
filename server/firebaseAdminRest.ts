import firebaseConfig from '../firebase-applet-config.json';

export interface ServerEnv {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_DATABASE_ID?: string;
  AUTH_CHALLENGE_SECRET?: string;
  CF_TURN_TOKEN_ID?: string;
  CF_TURN_API_TOKEN?: string;
  TURN_URLS?: string;
  TURN_USERNAME?: string;
  TURN_CREDENTIAL?: string;
  TURN_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

export interface ServiceAccountCredentials {
  project_id: string;
  client_email: string;
  private_key: string;
}

const PBKDF2_ITERATIONS = 100_000;
const PIN_PBKDF2_PREFIX = 'pbkdf2_v3$';
const PASSWORD_PBKDF2_PREFIX = 'pbkdf2_pwd_v1$';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const cleaned = input.replace(/\s+/g, '');
  const base64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stripOuterQuotes(value?: string): string {
  const trimmed = (value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function strToBase64Url(str: string): string {
  return bytesToBase64Url(textEncoder.encode(str));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function generateSaltHex(length = 16): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

export async function deriveUidFromEmailServer(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(`mender_email_uid:${normalized}`)
  );
  return `usr_${bytesToHex(new Uint8Array(digest)).slice(0, 24)}`;
}

export async function hashPasswordServer(password: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(`${password}:mender_pwd_pepper_v1`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: textEncoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return `${PASSWORD_PBKDF2_PREFIX}${bytesToHex(new Uint8Array(derived))}`;
}

export async function verifyPasswordHashServer(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!expectedHash || !salt || !password) return false;
  const computed = await hashPasswordServer(password, salt);
  return constantTimeEqual(computed, expectedHash);
}

export async function hashPinServer(pin: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(`${pin}:mender_pepper_v3`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: textEncoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return `${PIN_PBKDF2_PREFIX}${bytesToHex(new Uint8Array(derived))}`;
}

async function legacyHashPinServer(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(`${salt}:${pin}:mender_v2`)
  );
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyPinHashServer(
  pin: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!expectedHash || !salt || !pin) return false;
  if (expectedHash.startsWith(PIN_PBKDF2_PREFIX)) {
    const computed = await hashPinServer(pin, salt);
    return constantTimeEqual(computed, expectedHash);
  }
  const computedLegacy = await legacyHashPinServer(pin, salt);
  return constantTimeEqual(computedLegacy, expectedHash);
}

export function resolveServiceAccount(env: ServerEnv): ServiceAccountCredentials {
  const rawJsonEnv = stripOuterQuotes(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (rawJsonEnv) {
    const jsonStr = rawJsonEnv.startsWith('{')
      ? rawJsonEnv
      : textDecoder.decode(base64UrlToBytes(rawJsonEnv));
    let parsed: Partial<ServiceAccountCredentials>;
    try {
      parsed = JSON.parse(jsonStr) as Partial<ServiceAccountCredentials>;
    } catch {
      throw new Error(
        'INVALID_FIREBASE_SERVICE_ACCOUNT_JSON: проверьте формат FIREBASE_SERVICE_ACCOUNT_JSON (должен быть валидный JSON или Base64 из Firebase Console).'
      );
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON missing client_email or private_key');
    }
    return {
      project_id:
        stripOuterQuotes(parsed.project_id) ||
        stripOuterQuotes(env.FIREBASE_PROJECT_ID) ||
        firebaseConfig.projectId,
      client_email: parsed.client_email.trim(),
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
    };
  }

  const clientEmail = stripOuterQuotes(env.FIREBASE_CLIENT_EMAIL);
  const privateKey = stripOuterQuotes(env.FIREBASE_PRIVATE_KEY);
  if (clientEmail && privateKey) {
    return {
      project_id: stripOuterQuotes(env.FIREBASE_PROJECT_ID) || firebaseConfig.projectId,
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    };
  }

  throw new Error(
    'SERVER_FIREBASE_CREDENTIALS_NOT_CONFIGURED: установите FIREBASE_SERVICE_ACCOUNT_JSON (или FIREBASE_CLIENT_EMAIL и FIREBASE_PRIVATE_KEY) в переменных окружения сервера / Cloudflare Pages.'
  );
}

export function getFirebaseProjectTargets(env: ServerEnv, sa?: ServiceAccountCredentials) {
  return {
    projectId:
      stripOuterQuotes(env.FIREBASE_PROJECT_ID) || sa?.project_id || firebaseConfig.projectId,
    databaseId:
      stripOuterQuotes(env.FIREBASE_DATABASE_ID) ||
      firebaseConfig.firestoreDatabaseId ||
      '(default)',
  };
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

const privateKeyCache = new Map<string, CryptoKey>();

async function importServiceAccountKey(pem: string): Promise<CryptoKey> {
  const cached = privateKeyCache.get(pem);
  if (cached) return cached;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  privateKeyCache.set(pem, key);
  return key;
}

async function signJwtRs256(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${strToBase64Url(JSON.stringify(header))}.${strToBase64Url(JSON.stringify(payload))}`;
  const key = await importServiceAccountKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    textEncoder.encode(signingInput)
  );
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function createFirebaseCustomToken(
  sa: ServiceAccountCredentials,
  uid: string,
  claims: Record<string, unknown> = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJwtRs256(
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now,
      exp: now + 3600,
      uid,
      claims: {
        email_verified: true,
        ...claims,
      },
    },
    sa.private_key
  );
}

const oauthTokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getGoogleAccessToken(sa: ServiceAccountCredentials): Promise<string> {
  const cached = oauthTokenCache.get(sa.client_email);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwtRs256(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth2 token exchange failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  oauthTokenCache.set(sa.client_email, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  });
  return data.access_token;
}

// =========================================================================
// Firebase ID Token Verification (via Google Secure Token JWK)
// =========================================================================

let jwkCache: { keys: Record<string, JsonWebKey>; expiresAt: number } | null = null;

async function getFirebasePublicJwks(): Promise<Record<string, JsonWebKey>> {
  if (jwkCache && jwkCache.expiresAt > Date.now()) {
    return jwkCache.keys;
  }
  const res = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error('Failed to fetch Firebase JWK public keys');
  }
  const body = (await res.json()) as { keys: Array<JsonWebKey & { kid?: string }> };
  const map: Record<string, JsonWebKey> = {};
  for (const k of body.keys || []) {
    if (k.kid) map[k.kid] = k;
  }
  jwkCache = { keys: map, expiresAt: Date.now() + 3600 * 1000 };
  return map;
}

export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string
): Promise<{ uid: string; email?: string; signInProvider?: string } | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(textDecoder.decode(base64UrlToBytes(parts[0]))) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(textDecoder.decode(base64UrlToBytes(parts[1]))) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      email?: string;
      firebase?: { sign_in_provider?: string };
    };

    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || !header.kid) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    if (!payload.exp || payload.exp <= now) return null;

    const jwks = await getFirebasePublicJwks();
    const jwk = jwks[header.kid];
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(parts[2]),
      textEncoder.encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return null;

    return {
      uid: payload.sub,
      email: payload.email,
      signInProvider: payload.firebase?.sign_in_provider,
    };
  } catch {
    return null;
  }
}

// =========================================================================
// Stateless HMAC-SHA256 Token for Password Recovery Challenges
// =========================================================================

async function getChallengeHmacKey(secretStr: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secretStr));
  return crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signRecoveryChallengeToken(
  payload: { uid: string; otpHash: string; exp: number },
  secret: string
): Promise<string> {
  const body = strToBase64Url(JSON.stringify(payload));
  const key = await getChallengeHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, textEncoder.encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

export async function verifyRecoveryChallengeToken(
  token: string,
  secret: string
): Promise<{ uid: string; otpHash: string; exp: number } | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const key = await getChallengeHmacKey(secret);
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(parts[1]),
    textEncoder.encode(parts[0])
  );
  if (!ok) return null;
  try {
    return JSON.parse(textDecoder.decode(base64UrlToBytes(parts[0])));
  } catch {
    return null;
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

// =========================================================================
// Firestore v1 REST Helpers
// =========================================================================

export interface FirestoreTimestampMarker {
  __serverTimestamp: true;
}

export const SERVER_TIMESTAMP_SENTINEL: FirestoreTimestampMarker = { __serverTimestamp: true };

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'object' && val !== null && '__serverTimestamp' in val) {
    return { timestampValue: new Date().toISOString() };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(v => toFirestoreValue(v)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function fromFirestoreValue(val: FirestoreValue | undefined): unknown {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

export function decodeFirestoreDoc(docJson: {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}): Record<string, any> | null {
  if (!docJson || !docJson.fields) return null;
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(docJson.fields)) {
    result[k] = fromFirestoreValue(v);
  }
  return result;
}

export class FirestoreRestClient {
  private baseUrl: string;
  private docPrefix: string;
  private token: string;

  constructor(projectId: string, databaseId: string, accessToken: string) {
    this.docPrefix = `projects/${projectId}/databases/${databaseId}/documents`;
    this.baseUrl = `https://firestore.googleapis.com/v1/${this.docPrefix}`;
    this.token = accessToken;
  }

  async getDoc(docPath: string): Promise<Record<string, any> | null> {
    const res = await fetch(`${this.baseUrl}/${docPath}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Firestore GET ${docPath} failed (${res.status}): ${await res.text()}`);
    }
    return decodeFirestoreDoc(await res.json());
  }

  async setDoc(docPath: string, data: Record<string, unknown>, mergeFields?: string[]): Promise<void> {
    const url = new URL(`${this.baseUrl}/${docPath}`);
    if (mergeFields && mergeFields.length > 0) {
      mergeFields.forEach(f => url.searchParams.append('updateMask.fieldPaths', f));
    }
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      throw new Error(`Firestore PATCH ${docPath} failed (${res.status}): ${await res.text()}`);
    }
  }

  async runStructuredQuery(
    collectionId: string,
    fieldPath?: string,
    op?: 'EQUAL' | 'IN',
    value?: unknown,
    limit = 200
  ): Promise<Array<Record<string, any>>> {
    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId }],
      limit,
    };
    if (fieldPath && op) {
      structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath },
          op,
          value: toFirestoreValue(value),
        },
      };
    }

    const res = await fetch(`${this.baseUrl}:runQuery`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ structuredQuery }),
    });
    if (!res.ok) {
      throw new Error(`Firestore runQuery ${collectionId} failed (${res.status}): ${await res.text()}`);
    }
    const rows = (await res.json()) as Array<{ document?: { name?: string; fields?: Record<string, FirestoreValue> } }>;
    const docs: Array<Record<string, any>> = [];
    for (const row of rows) {
      if (row.document) {
        const decoded = decodeFirestoreDoc(row.document);
        if (decoded) docs.push(decoded);
      }
    }
    return docs;
  }
}
