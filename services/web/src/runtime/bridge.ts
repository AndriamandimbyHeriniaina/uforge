import type { AppDatabaseApi } from './database';
import { RuntimeCallError } from './errors';
import {
  capturePhoto,
  deviceInfo,
  httpRequest,
  openExternal,
  pickAsDataUrls,
  saveFile,
  shareContent,
} from './native';

/** Capabilities the app must declare in uforge.json (doc/features/device-bridge.md). */
export const DECLARED_CAPABILITIES = ['camera', 'network', 'geolocation', 'notifications', 'haptics'];
/** Declared capabilities this Runtime implements today. */
const IMPLEMENTED = new Set(['camera', 'network']);

export type BridgeOptions = {
  db: AppDatabaseApi;
  capabilities: string[];
};

type Handler = (params: Record<string, unknown>) => unknown;

/**
 * Host side of `window.runtime`. Validates the declared capability, then routes
 * to the database or to a device feature. Nothing here can reach the workshop.
 *
 * @example
 * const bridge = createBridge({ db, capabilities: ['camera'] });
 * const value = await bridge.call('db.query', { sql: 'SELECT 1 AS one' });
 */
export function createBridge(options: BridgeOptions): { call: (method: string, params: unknown) => Promise<unknown> } {
  const declared = new Set(options.capabilities.filter((cap) => DECLARED_CAPABILITIES.includes(cap)));
  const need = (capability: string): void => {
    if (!declared.has(capability)) {
      throw new RuntimeCallError(
        'permission',
        `Capacité « ${capability} » non déclarée dans uforge.json → capabilities`,
      );
    }
    if (!IMPLEMENTED.has(capability)) {
      throw new RuntimeCallError('unavailable', `Capacité « ${capability} » pas encore disponible sur cet appareil`);
    }
  };
  const key = (params: Record<string, unknown>): string => {
    if (typeof params.key !== 'string' || !params.key || params.key.length > 500) {
      throw new RuntimeCallError('invalid', 'clé invalide');
    }
    return params.key;
  };
  const sql = (params: Record<string, unknown>): string => {
    if (typeof params.sql !== 'string') {
      throw new RuntimeCallError('invalid', 'sql doit être une chaîne');
    }
    return params.sql;
  };

  const handlers: Record<string, Handler> = {
    'capabilities.has': (params) => {
      const name = String(params.name ?? '');
      if (['storage', 'db', 'database', 'files', 'share', 'browser', 'device'].includes(name)) {
        return true;
      }
      return declared.has(name) && IMPLEMENTED.has(name);
    },
    'storage.get': (params) => options.db.kvGet(key(params)),
    'storage.set': (params) => {
      options.db.kvSet(key(params), params.value);
      return null;
    },
    'storage.remove': (params) => {
      options.db.kvRemove(key(params));
      return null;
    },
    'storage.keys': () => options.db.kvKeys(),
    'db.query': (params) => options.db.query(sql(params), params.params),
    'db.exec': (params) => options.db.exec(sql(params), params.params),
    'db.batch': (params) => options.db.batch(params.statements),
    'db.migrate': (params) => options.db.migrate(params.steps),
    'camera.capture': (params) => {
      need('camera');
      return capturePhoto(params);
    },
    'files.pick': (params) => pickAsDataUrls(params),
    'files.save': (params) => {
      if (typeof params.name !== 'string' || typeof params.data !== 'string') {
        throw new RuntimeCallError('invalid', 'files.save attend { name, mime, data }');
      }
      return saveFile(params.name, typeof params.mime === 'string' ? params.mime : 'text/plain', params.data);
    },
    'share.send': (params) =>
      shareContent({
        title: optionalString(params.title),
        text: optionalString(params.text),
        url: optionalString(params.url),
      }),
    'browser.open': (params) => openExternal(String(params.url ?? '')),
    'device.info': () => deviceInfo(),
    'http.request': (params) => {
      need('network');
      return httpRequest(params);
    },
    'geo.position': () => {
      need('geolocation');
      return null;
    },
    'notify.schedule': () => {
      need('notifications');
      return null;
    },
    'haptics.impact': () => {
      need('haptics');
      return null;
    },
  };

  return {
    async call(method, params) {
      const handler = handlers[method];
      if (!handler) {
        throw new RuntimeCallError('invalid', `méthode inconnue : runtime.${method}`);
      }
      const input = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
      return handler(input);
    },
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}
