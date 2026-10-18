import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { RUNTIME_VERSION } from '../config';
import { fromBase64, sha256Hex, toBase64, utf8 } from '../lib/bytes';
import { importRawKey, open, seal, type Sealed } from '../lib/crypto';
import { readAdminSealed, readAppBlock, readLiveDb, replaceInstall, sealForDevice } from './device';
import type { HappHeader } from './types';

export type ExportOptions = { withData: boolean; frozen: boolean };

export type ParsedHapp = { header: HappHeader; files: Record<string, Uint8Array> };

/**
 * Builds the .happ file of the installed app (doc/features/happ.md).
 * app/data are sealed with a fresh K_share (in the header: not a secret);
 * admin.bin is the K_admin-sealed block, copied as is, absent when frozen.
 *
 * @example
 * const { bytes, fileName } = await buildHappFile(header, { withData: false, frozen: true });
 */
export async function buildHappFile(
  header: HappHeader,
  options: ExportOptions,
): Promise<{ bytes: Uint8Array; fileName: string }> {
  const app = await readAppBlock(header.appId);
  if (!app) {
    throw new Error('Aucune version validée à exporter : fais « Builder » d’abord.');
  }
  const shareRaw = crypto.getRandomValues(new Uint8Array(32));
  const kShare = await importRawKey(shareRaw, false);
  const files: Zippable = {};
  const blocks: NonNullable<HappHeader['blocks']> = {};

  const put = async (name: 'app' | 'data' | 'admin', sealed: Sealed): Promise<void> => {
    files[`${name}.bin`] = [sealed.ct, { level: 0 }];
    blocks[name] = { iv: toBase64(sealed.iv), sha256: await sha256Hex(sealed.ct), size: sealed.ct.length };
  };

  await put('app', await seal(kShare, utf8(JSON.stringify(app)), `${header.appId}:app`));
  if (options.withData) {
    const data = await readLiveDb(header.appId);
    if (data) {
      await put('data', await seal(kShare, data, `${header.appId}:data`));
    }
  }
  const admin = !options.frozen && header.crypto.admin ? await readAdminSealed() : null;
  if (admin) {
    await put('admin', admin);
  }

  const fileHeader: HappHeader = {
    ...header,
    exportedAt: new Date().toISOString(),
    options: { frozen: !admin, withData: Boolean(blocks.data) },
    crypto: {
      shareKey: toBase64(shareRaw),
      ...(admin && header.crypto.admin ? { admin: header.crypto.admin } : {}),
    },
    blocks,
  };
  files['header.json'] = [strToU8(JSON.stringify(fileHeader, null, 2)), { level: 6 }];
  return { bytes: zipSync(files), fileName: `${slug(header.name)}.happ` };
}

/**
 * Reads and validates a .happ (no decryption yet).
 *
 * @example
 * const parsed = parseHappFile(new Uint8Array(await file.arrayBuffer()));
 */
export function parseHappFile(bytes: Uint8Array): ParsedHapp {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('Ce fichier n’est pas une appli Uforge.');
  }
  const rawHeader = files['header.json'];
  if (!rawHeader || !files['app.bin']) {
    throw new Error('Ce fichier n’est pas une appli Uforge.');
  }
  let header: HappHeader;
  try {
    header = JSON.parse(strFromU8(rawHeader)) as HappHeader;
  } catch {
    throw new Error('En-tête illisible : fichier corrompu.');
  }
  if (header.format !== 1 || typeof header.appId !== 'string' || !header.crypto?.shareKey || !header.blocks?.app) {
    throw new Error('Format d’appli inconnu.');
  }
  if (compareVersions(header.runtimeMin ?? '1.0.0', RUNTIME_VERSION) > 0) {
    throw new Error('Cette appli demande une version plus récente de Uforge : mets à jour Uforge.');
  }
  return { header, files };
}

/**
 * Installs a parsed .happ: decrypt with K_share, re-seal with K_device, keep
 * admin.bin as is, then replace the installed app in ONE transaction.
 *
 * @example
 * const header = await installHapp(parsed);
 */
export async function installHapp(parsed: ParsedHapp): Promise<HappHeader> {
  const { header, files } = parsed;
  const blocks = header.blocks ?? {};
  const kShare = await importRawKey(fromBase64(header.crypto.shareKey ?? ''), false);

  const unseal = async (name: 'app' | 'data'): Promise<Uint8Array | null> => {
    const ct = files[`${name}.bin`];
    const meta = blocks[name];
    if (!ct || !meta) {
      return null;
    }
    if ((await sha256Hex(ct)) !== meta.sha256) {
      throw new Error('Fichier corrompu ou modifié : installation annulée.');
    }
    try {
      return await open(kShare, { iv: fromBase64(meta.iv), ct }, `${header.appId}:${name}`);
    } catch {
      throw new Error('Fichier corrompu ou modifié : installation annulée.');
    }
  };

  const appBytes = await unseal('app');
  if (!appBytes) {
    throw new Error('Le fichier ne contient pas d’appli.');
  }
  const dataBytes = await unseal('data');
  let admin: Sealed | undefined;
  if (files['admin.bin'] && blocks.admin && header.crypto.admin) {
    if ((await sha256Hex(files['admin.bin'])) !== blocks.admin.sha256) {
      throw new Error('Fichier corrompu ou modifié : installation annulée.');
    }
    admin = { iv: fromBase64(blocks.admin.iv), ct: files['admin.bin'] };
  }

  const deviceHeader: HappHeader = {
    format: 1,
    runtimeMin: header.runtimeMin,
    appId: header.appId,
    name: header.name,
    description: header.description,
    icon: header.icon,
    owner: header.owner,
    version: header.version,
    builtAt: header.builtAt,
    exportedAt: header.exportedAt,
    options: { frozen: !admin, withData: Boolean(dataBytes) },
    capabilities: header.capabilities ?? [],
    crypto: admin && header.crypto.admin ? { admin: header.crypto.admin } : {},
  };
  await replaceInstall({
    header: deviceHeader,
    app: await sealForDevice(header.appId, 'app', appBytes),
    data: dataBytes ? await sealForDevice(header.appId, 'data', dataBytes) : undefined,
    admin,
  });
  return deviceHeader;
}

function slug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'mon-appli'
  );
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}
