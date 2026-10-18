/**
 * Minimal IndexedDB key-value store (`uforge` database, `kv` store).
 * Values are structured-cloned: CryptoKey and Uint8Array are stored as is.
 */

const DB_NAME = 'uforge';
const STORE = 'kv';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        opening = null;
        reject(request.error);
      };
    });
  }
  return opening;
}

/**
 * Reads one value.
 *
 * @example
 * const header = await idbGet<HappHeader>('happ.header');
 */
export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export type IdbWrite = { key: string; value: unknown } | { key: string; delete: true };

/**
 * Applies several puts/deletes in ONE transaction: all or nothing.
 *
 * @example
 * await idbWrite([{ key: 'happ.header', value: header }, { key: 'happ.preview', delete: true }]);
 */
export async function idbWrite(writes: IdbWrite[]): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const write of writes) {
      if ('delete' in write) {
        store.delete(write.key);
      } else {
        store.put(write.value, write.key);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

/**
 * Writes one value.
 *
 * @example
 * await idbSet('happ.data', { iv, ct });
 */
export function idbSet(key: string, value: unknown): Promise<void> {
  return idbWrite([{ key, value }]);
}
