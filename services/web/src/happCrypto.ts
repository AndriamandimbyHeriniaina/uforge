/**
 * Device-side .happ encryption. The gateway never sees the artefact or this key.
 *
 * 1. Wrap the password with HMAC-SHA-256 keyed by the email.
 * 2. Derive the AES-256-GCM key with PBKDF2 (salt = email) from that wrap.
 *
 * @example
 * const envelope = await encryptHapp(happ, 'secret');
 * const plain = await decryptHapp(envelope, 'secret');
 */

export type LocalHapp = {
  email: string;
  name: string;
  spec: unknown;
  appId?: string;
  /** Minified guest JS from the compiler. Overlay is never stored here. */
  bundleJs?: string;
  /** SQLite seed applied only when the overlay file is empty. */
  seedSql?: string;
  manifest?: {
    id: string;
    version: string;
    name?: string;
    runtime?: { min_version?: string };
    capabilities?: string[];
  };
};

export type HappEnvelope = {
  v: 1;
  alg: 'A256GCM';
  email: string;
  iv: string;
  ciphertext: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PBKDF2_ITERATIONS = 210_000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += Array.from(slice, (byte) => String.fromCharCode(byte)).join('');
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * HMAC-SHA-256(password) keyed by the account email.
 *
 * @example
 * const wrapped = await wrapPasswordWithEmail('ada@uforge.app', 'horse');
 */
async function wrapPasswordWithEmail(
  email: string,
  password: string,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalizeEmail(email)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, encoder.encode(password));
}

/**
 * Builds the AES key: hash(email + wrapped password) via PBKDF2.
 *
 * @example
 * const key = await deriveHappKey('ada@uforge.app', 'horse');
 */
async function deriveHappKey(email: string, password: string): Promise<CryptoKey> {
  const wrapped = await wrapPasswordWithEmail(email, password);
  const material = await crypto.subtle.importKey('raw', wrapped, 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(normalizeEmail(email)),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function isEnvelope(value: unknown): value is HappEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const row = value as HappEnvelope;
  return (
    row.v === 1 &&
    typeof row.email === 'string' &&
    typeof row.iv === 'string' &&
    typeof row.ciphertext === 'string'
  );
}

/**
 * Encrypts the .happ payload (spec, JS, name). Email stays in the clear envelope.
 *
 * @example
 * const envelope = await encryptHapp(happ, password);
 */
export async function encryptHapp(
  happ: LocalHapp,
  password: string,
): Promise<HappEnvelope> {
  const email = normalizeEmail(happ.email);
  const key = await deriveHappKey(email, password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(
    JSON.stringify({
      name: happ.name,
      spec: happ.spec,
      appId: happ.appId,
      bundleJs: happ.bundleJs,
      seedSql: happ.seedSql,
      manifest: happ.manifest,
    }),
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(email) },
    key,
    plaintext,
  );
  return {
    v: 1,
    alg: 'A256GCM',
    email,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

/**
 * Decrypts a device envelope with the account password.
 *
 * @example
 * const happ = await decryptHapp(envelope, password);
 */
export async function decryptHapp(
  envelope: HappEnvelope,
  password: string,
): Promise<LocalHapp> {
  const email = normalizeEmail(envelope.email);
  const key = await deriveHappKey(email, password);
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(envelope.iv),
        additionalData: encoder.encode(email),
      },
      key,
      base64ToBytes(envelope.ciphertext),
    );
    const payload = JSON.parse(decoder.decode(plain)) as {
      name?: string;
      spec?: unknown;
      appId?: string;
      bundleJs?: string;
      seedSql?: string;
      manifest?: LocalHapp['manifest'];
    };
    return {
      email,
      name: payload.name ?? 'Mon application',
      spec: payload.spec ?? null,
      appId: payload.appId,
      bundleJs: payload.bundleJs,
      seedSql: payload.seedSql,
      manifest: payload.manifest,
    };
  } catch {
    throw new Error('Mot de passe incorrect');
  }
}

/**
 * Reads a stored envelope without decrypting it.
 *
 * @example
 * const envelope = parseHappEnvelope(localStorage.getItem('uforge-happ-payload'));
 */
export function parseHappEnvelope(raw: string | null): HappEnvelope | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isEnvelope(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
