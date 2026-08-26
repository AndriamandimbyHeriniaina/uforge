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
