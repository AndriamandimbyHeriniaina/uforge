import { fromBase64, toBase64, utf8 } from './bytes';
import { idbGet, idbSet } from './idb';

/**
 * WebCrypto helpers for the key model of doc/features/encryption.md.
 * K_admin (random, wrapped by a password KEK), K_device (non-extractable),
 * K_share (random, travels with an export).
 */

export const KDF_ITERATIONS = 600_000;

export type Sealed = { iv: Uint8Array; ct: Uint8Array };

export type AdminKeyWrap = {
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  wrapIv: string;
  keyWrap: string;
};

/**
 * Normalised account email used as HMAC key and in the header.
 *
 * @example
 * normalizeEmail(' Ada@Example.com '); // 'ada@example.com'
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * AES-256-GCM encryption with a random 12-byte IV and an AAD label.
 *
 * @example
 * const sealed = await seal(key, bytes, `${appId}:data`);
 */
export async function seal(key: CryptoKey, data: Uint8Array, aad: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: utf8(aad) as BufferSource }, key, data as BufferSource),
  );
  return { iv, ct };
}

/**
 * AES-256-GCM decryption. Throws on a wrong key or tampered data.
 *
 * @example
 * const bytes = await open(key, sealed, `${appId}:data`);
 */
export async function open(key: CryptoKey, sealed: Sealed, aad: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: sealed.iv as BufferSource, additionalData: utf8(aad) as BufferSource },
      key,
      sealed.ct as BufferSource,
    ),
  );
}

/**
 * New random AES key. `extractable` only for keys that must be wrapped or exported.
 *
 * @example
 * const kAdmin = await randomKey(true);
 */
export function randomKey(extractable: boolean): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, extractable, [
    'encrypt',
    'decrypt',
  ]) as Promise<CryptoKey>;
}

/**
 * Imports raw AES key bytes (K_share from a .happ header, unwrapped K_admin).
 *
 * @example
 * const kShare = await importRawKey(fromBase64(header.crypto.shareKey), false);
 */
export function importRawKey(raw: Uint8Array, extractable: boolean): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, extractable, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * KEK = PBKDF2-SHA-256(HMAC-SHA-256(email, password), salt, iterations).
 *
 * @example
 * const kek = await deriveKek('ada@example.com', 'secret', salt, KDF_ITERATIONS);
 */
export async function deriveKek(
  email: string,
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    utf8(normalizeEmail(email)) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const pre = await crypto.subtle.sign('HMAC', hmacKey, utf8(password) as BufferSource);
  const material = await crypto.subtle.importKey('raw', pre, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Wraps K_admin with a KEK derived from the password (fresh salt).
 *
 * @example
 * header.crypto.admin = await wrapAdminKey(kAdmin, email, password, appId);
 */
export async function wrapAdminKey(
  kAdmin: CryptoKey,
  email: string,
  password: string,
  appId: string,
): Promise<AdminKeyWrap> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKek(email, password, salt, KDF_ITERATIONS);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kAdmin));
  const sealed = await seal(kek, raw, `${appId}:kadmin`);
  raw.fill(0);
  return {
    kdf: 'PBKDF2-SHA-256',
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    wrapIv: toBase64(sealed.iv),
    keyWrap: toBase64(sealed.ct),
  };
}

/**
 * Unwraps K_admin. Throws `Mot de passe incorrect` on a wrong password.
 *
 * @example
 * const kAdmin = await unwrapAdminKey(header.crypto.admin, header.owner, password, header.appId);
 */
export async function unwrapAdminKey(
  wrap: AdminKeyWrap,
  email: string,
  password: string,
  appId: string,
): Promise<CryptoKey> {
  const kek = await deriveKek(email, password, fromBase64(wrap.salt), wrap.iterations);
  try {
    const raw = await open(
      kek,
      { iv: fromBase64(wrap.wrapIv), ct: fromBase64(wrap.keyWrap) },
      `${appId}:kadmin`,
    );
    const key = await importRawKey(raw, true);
    raw.fill(0);
    return key;
  } catch {
    throw new Error('Mot de passe incorrect');
  }
}

let deviceKey: Promise<CryptoKey> | null = null;

/**
 * K_device: created once per install, non-extractable, kept in IndexedDB.
 *
 * @example
 * const sealed = await seal(await getDeviceKey(), bytes, `${appId}:app`);
 */
export function getDeviceKey(): Promise<CryptoKey> {
  if (!deviceKey) {
    deviceKey = (async () => {
      const existing = await idbGet<CryptoKey>('device.key');
      if (existing) {
        return existing;
      }
      const key = await randomKey(false);
      await idbSet('device.key', key);
      return key;
    })();
    deviceKey.catch(() => {
      deviceKey = null;
    });
  }
  return deviceKey;
}
