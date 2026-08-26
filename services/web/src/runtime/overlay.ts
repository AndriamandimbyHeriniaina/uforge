import type { AppSpec } from './types';

const PREFIX = 'uforge-overlay:';

export type OverlayState = {
  kv: Record<string, unknown>;
  collections: Record<string, Array<Record<string, unknown>>>;
};

function emptyOverlay(): OverlayState {
  return { kv: {}, collections: {} };
}

/**
 * Loads the live overlay stored beside the encrypted .happ, never inside it.
 *
 * @example
 * const overlay = loadOverlay('app-id');
 */
export function loadOverlay(appId: string): OverlayState {
  const raw = localStorage.getItem(PREFIX + appId);
  if (!raw) {
    return emptyOverlay();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OverlayState>;
    return {
      kv: parsed.kv && typeof parsed.kv === 'object' ? parsed.kv : {},
      collections:
        parsed.collections && typeof parsed.collections === 'object'
          ? parsed.collections
          : {},
    };
  } catch {
    return emptyOverlay();
  }
}

/**
 * Persists overlay mutations on the device, outside the .happ.
 *
 * @example
 * saveOverlay('app-id', overlay);
 */
export function saveOverlay(appId: string, overlay: OverlayState): void {
  localStorage.setItem(PREFIX + appId, JSON.stringify(overlay));
}

/**
 * Copies spec.seed into empty overlay collections. Never overwrites live rows.
 *
 * @example
 * applySeed('app-id', spec);
 */
export function applySeed(appId: string, spec: AppSpec): OverlayState {
  const overlay = loadOverlay(appId);
  const seed = spec.seed;
  if (!seed) {
    return overlay;
  }
  let changed = false;
  for (const [key, rows] of Object.entries(seed)) {
    if (!Array.isArray(rows) || rows.length === 0) {
      continue;
    }
    if ((overlay.collections[key] ?? []).length > 0) {
      continue;
    }
    overlay.collections[key] = rows.map((row, index) => {
      if (row && typeof row === 'object') {
        const rec = { ...(row as Record<string, unknown>) };
        rec.id = String(rec.id ?? `seed-${index + 1}`);
        return rec;
      }
      return { id: `seed-${index + 1}`, title: String(row) };
    });
    changed = true;
  }
  if (changed) {
    saveOverlay(appId, overlay);
  }
  return overlay;
}

/**
 * Drops every live overlay on this Runtime. The encrypted .happ is left untouched.
 *
 * @example
 * clearAllOverlays();
 */
export function clearAllOverlays(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      keys.push(key);
    }
  }
  keys.forEach((key) => localStorage.removeItem(key));
}
