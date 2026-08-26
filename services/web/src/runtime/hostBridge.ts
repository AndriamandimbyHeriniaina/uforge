import {
  dbQuery,
  dbRemove,
  dbUpsert,
  kvGet,
  kvList,
  kvRemove,
  kvSet,
} from './sqlite';
import type { AppSpec, HappManifest } from './types';

export type BridgeMedia = {
  pickImage: () => Promise<string | null>;
  pickFile: () => Promise<{ name: string; dataUrl: string } | null>;
  share: (text: string) => Promise<void>;
};

export type BridgeExtras = {
  seedSql?: string;
  manifest?: HappManifest | null;
};

/**
 * Dispatches one guest `runtime.*` call. Missing capabilities are denied.
 * Overlay writes go to SQLite (IndexedDB / native file), never into the .happ.
 *
 * @example
 * const result = await handleRuntimeCall(appId, spec, 'storage.get', { key: 'n' }, media);
 */
export async function handleRuntimeCall(
  appId: string,
  spec: AppSpec,
  method: string,
  params: Record<string, unknown> = {},
  media: BridgeMedia,
  extras: BridgeExtras = {},
): Promise<unknown> {
  const caps = new Set([
    ...(spec.capabilities ?? []),
    ...(extras.manifest?.capabilities ?? []),
  ]);
  const need = capabilityFor(method);
  if (need && !caps.has(need)) {
    throw new Error(`permission denied: ${need}`);
  }

  const seedSql = extras.seedSql;

  switch (method) {
    case 'capabilities.has':
      return caps.has(String(params.name ?? ''));
    case 'storage.get':
      return kvGet(appId, spec, String(params.key ?? ''), seedSql);
    case 'storage.set': {
      await kvSet(appId, spec, String(params.key ?? ''), params.value ?? null, seedSql);
      return true;
    }
    case 'storage.remove': {
      await kvRemove(appId, spec, String(params.key ?? ''), seedSql);
      return true;
    }
    case 'storage.list':
      return kvList(appId, spec, seedSql);
    case 'db.list':
    case 'db.query': {
      const collection = String(params.collection ?? params.sql ?? 'items');
      return dbQuery(appId, spec, collection, seedSql);
    }
    case 'db.upsert': {
      const collection = String(params.collection ?? 'items');
      const record = (params.record ?? {}) as Record<string, unknown>;
      return dbUpsert(appId, spec, collection, record, seedSql);
    }
    case 'db.remove': {
      const collection = String(params.collection ?? 'items');
      await dbRemove(appId, spec, collection, String(params.id ?? ''), seedSql);
      return true;
    }
    case 'camera.capture': {
      const dataUrl = await media.pickImage();
      if (!dataUrl) {
        return null;
      }
      return { dataUrl };
    }
    case 'files.pick':
      return media.pickFile();
    case 'share.send':
      await media.share(String(params.text ?? params.data ?? ''));
      return true;
    default:
      throw new Error(`unknown runtime method: ${method}`);
  }
}

function capabilityFor(method: string): string | null {
  if (method.startsWith('storage.')) {
    return 'storage';
  }
  if (method.startsWith('db.')) {
    return 'database';
  }
  if (method.startsWith('camera.')) {
    return 'camera';
  }
  if (method.startsWith('files.')) {
    return 'files';
  }
  if (method.startsWith('share.')) {
    return 'share';
  }
  return null;
}
