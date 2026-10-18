import { fromUtf8, utf8 } from '../lib/bytes';
import { getDeviceKey, open, seal, type Sealed } from '../lib/crypto';
import { idbGet, idbWrite, type IdbWrite } from '../lib/idb';
import type { AdminBlock, AppBlock, HappHeader } from './types';

/**
 * On-device storage of the single installed app (doc/features/runtime.md):
 * header (clear), build + live data (K_device), admin block + preview data (K_admin).
 */
export const KEYS = {
  header: 'happ.header',
  app: 'happ.app',
  data: 'happ.data',
  admin: 'happ.admin',
  preview: 'happ.preview',
} as const;

const aad = (appId: string, block: string): string => `${appId}:${block}`;

/**
 * @example
 * const header = await readHeader();
 */
export async function readHeader(): Promise<HappHeader | null> {
  return (await idbGet<HappHeader>(KEYS.header)) ?? null;
}

/**
 * @example
 * if (await hasBlock('app')) startLiveApp();
 */
export async function hasBlock(block: 'app' | 'data' | 'admin' | 'preview'): Promise<boolean> {
  return Boolean(await idbGet<Sealed>(KEYS[block]));
}

/**
 * Decrypts the validated build.
 *
 * @example
 * const app = await readAppBlock(header.appId);
 */
export async function readAppBlock(appId: string): Promise<AppBlock | null> {
  const sealed = await idbGet<Sealed>(KEYS.app);
  if (!sealed) {
    return null;
  }
  const bytes = await open(await getDeviceKey(), sealed, aad(appId, 'app'));
  return JSON.parse(fromUtf8(bytes)) as AppBlock;
}

/**
 * Stores a new build and its header in one transaction (Builder).
 *
 * @example
 * await writeBuild(nextHeader, appBlock);
 */
export async function writeBuild(header: HappHeader, block: AppBlock): Promise<void> {
  const sealed = await seal(await getDeviceKey(), utf8(JSON.stringify(block)), aad(header.appId, 'app'));
  await idbWrite([
    { key: KEYS.app, value: sealed },
    { key: KEYS.header, value: header },
  ]);
}

/**
 * Live database bytes (K_device).
 *
 * @example
 * const bytes = await readLiveDb(appId);
 */
export async function readLiveDb(appId: string): Promise<Uint8Array | null> {
  const sealed = await idbGet<Sealed>(KEYS.data);
  return sealed ? open(await getDeviceKey(), sealed, aad(appId, 'data')) : null;
}

/**
 * @example
 * await writeLiveDb(appId, db.export());
 */
export async function writeLiveDb(appId: string, bytes: Uint8Array): Promise<void> {
  const sealed = await seal(await getDeviceKey(), bytes, aad(appId, 'data'));
  await idbWrite([{ key: KEYS.data, value: sealed }]);
}

/**
 * Raw sealed admin block (exported as is in a .happ).
 *
 * @example
 * const sealed = await readAdminSealed();
 */
export async function readAdminSealed(): Promise<Sealed | null> {
  return (await idbGet<Sealed>(KEYS.admin)) ?? null;
}

/**
 * @example
 * const admin = await readAdminBlock(appId, kAdmin);
 */
export async function readAdminBlock(appId: string, kAdmin: CryptoKey): Promise<AdminBlock> {
  const sealed = await readAdminSealed();
  if (!sealed) {
    throw new Error('Aucun atelier sur cet appareil');
  }
  return JSON.parse(fromUtf8(await open(kAdmin, sealed, aad(appId, 'admin')))) as AdminBlock;
}

/**
 * @example
 * const sealed = await sealAdminBlock(appId, kAdmin, admin);
 */
export function sealAdminBlock(appId: string, kAdmin: CryptoKey, block: AdminBlock): Promise<Sealed> {
  return seal(kAdmin, utf8(JSON.stringify(block)), aad(appId, 'admin'));
}

/**
 * @example
 * await writeAdminBlock(appId, kAdmin, admin);
 */
export async function writeAdminBlock(appId: string, kAdmin: CryptoKey, block: AdminBlock): Promise<void> {
  await idbWrite([{ key: KEYS.admin, value: await sealAdminBlock(appId, kAdmin, block) }]);
}

/**
 * @example
 * const bytes = await readPreviewDb(appId, kAdmin);
 */
export async function readPreviewDb(appId: string, kAdmin: CryptoKey): Promise<Uint8Array | null> {
  const sealed = await idbGet<Sealed>(KEYS.preview);
  return sealed ? open(kAdmin, sealed, aad(appId, 'preview')) : null;
}

/**
 * @example
 * await writePreviewDb(appId, kAdmin, bytes);
 */
export async function writePreviewDb(appId: string, kAdmin: CryptoKey, bytes: Uint8Array | null): Promise<void> {
  if (!bytes) {
    await idbWrite([{ key: KEYS.preview, delete: true }]);
    return;
  }
  await idbWrite([{ key: KEYS.preview, value: await seal(kAdmin, bytes, aad(appId, 'preview')) }]);
}

/**
 * Replaces whatever is installed, atomically.
 *
 * @example
 * await replaceInstall({ header, admin: sealedAdmin });
 */
export async function replaceInstall(parts: {
  header: HappHeader;
  admin?: Sealed;
  app?: Sealed;
  data?: Sealed;
}): Promise<void> {
  const writes: IdbWrite[] = [{ key: KEYS.header, value: parts.header }];
  for (const block of ['admin', 'app', 'data'] as const) {
    const value = parts[block];
    writes.push(value ? { key: KEYS[block], value } : { key: KEYS[block], delete: true });
  }
  writes.push({ key: KEYS.preview, delete: true });
  await idbWrite(writes);
}

/**
 * Seals bytes with K_device for this app (used by import).
 *
 * @example
 * const sealed = await sealForDevice(appId, 'app', bytes);
 */
export async function sealForDevice(appId: string, block: 'app' | 'data', bytes: Uint8Array): Promise<Sealed> {
  return seal(await getDeviceKey(), bytes, aad(appId, block));
}

/**
 * « Tout effacer » : build, data, admin block. The device key stays.
 *
 * @example
 * await wipeInstall();
 */
export async function wipeInstall(): Promise<void> {
  await idbWrite(Object.values(KEYS).map((key) => ({ key, delete: true as const })));
}

/**
 * « Vider les données » : live and preview databases.
 *
 * @example
 * await clearAppData();
 */
export async function clearAppData(): Promise<void> {
  await idbWrite([
    { key: KEYS.data, delete: true },
    { key: KEYS.preview, delete: true },
  ]);
}
