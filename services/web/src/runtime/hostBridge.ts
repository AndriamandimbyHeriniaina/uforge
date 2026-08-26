import { loadOverlay, saveOverlay } from './overlay';
import type { AppSpec } from './types';

export type BridgeMedia = {
  pickImage: () => Promise<string | null>;
  pickFile: () => Promise<{ name: string; dataUrl: string } | null>;
  share: (text: string) => Promise<void>;
};

/**
 * Dispatches one guest `runtime.*` call. Missing capabilities are denied.
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
): Promise<unknown> {
  const caps = new Set(spec.capabilities ?? []);
  const need = capabilityFor(method);
  if (need && !caps.has(need)) {
    throw new Error(`permission denied: ${need}`);
  }

  const overlay = loadOverlay(appId);

  switch (method) {
    case 'capabilities.has':
      return caps.has(String(params.name ?? ''));
    case 'storage.get':
      return overlay.kv[String(params.key ?? '')] ?? null;
    case 'storage.set': {
      overlay.kv[String(params.key ?? '')] = params.value ?? null;
      saveOverlay(appId, overlay);
      return true;
    }
    case 'storage.remove': {
      delete overlay.kv[String(params.key ?? '')];
      saveOverlay(appId, overlay);
      return true;
    }
    case 'storage.list':
      return Object.keys(overlay.kv);
    case 'db.list':
    case 'db.query': {
      const collection = String(params.collection ?? params.sql ?? 'items');
      return overlay.collections[collection] ?? [];
    }
    case 'db.upsert': {
      const collection = String(params.collection ?? 'items');
      const record = (params.record ?? {}) as Record<string, unknown>;
      const id = String(record.id ?? crypto.randomUUID());
      const rows = overlay.collections[collection] ?? [];
      const next = { ...record, id };
      const index = rows.findIndex((row) => String(row.id) === id);
      if (index >= 0) {
        rows[index] = next;
      } else {
        rows.push(next);
      }
      overlay.collections[collection] = rows;
      saveOverlay(appId, overlay);
      return next;
    }
    case 'db.remove': {
      const collection = String(params.collection ?? 'items');
      const id = String(params.id ?? '');
      overlay.collections[collection] = (overlay.collections[collection] ?? []).filter(
        (row) => String(row.id) !== id,
      );
      saveOverlay(appId, overlay);
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
