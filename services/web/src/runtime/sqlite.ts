import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { loadOverlay } from './overlay';
import { nativeReadOverlay, nativeWriteOverlay } from './native';
import { seedSqlFromSpec } from './seedSql';
import type { AppSpec } from './types';

const IDB_NAME = 'uforge-sqlite';
const IDB_STORE = 'overlays';

let sqlJs: SqlJsStatic | null = null;
const openDbs = new Map<string, Database>();

async function engine(): Promise<SqlJsStatic> {
  if (!sqlJs) {
    sqlJs = await initSqlJs({ locateFile: () => wasmUrl });
  }
  return sqlJs;
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(appId: string): Promise<Uint8Array | null> {
  try {
    const db = await idb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(appId);
      req.onsuccess = () => {
        const value = req.result;
        resolve(value instanceof Uint8Array ? value : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(appId: string, bytes: Uint8Array): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, appId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function persist(appId: string, database: Database): Promise<void> {
  const bytes = database.export();
  const native = await nativeWriteOverlay(appId, bytes);
  if (!native) {
    await idbSet(appId, bytes);
  }
}

/**
 * Opens (or creates) the overlay SQLite file for one app. Seed is applied only
 * when the overlay is empty. Live writes stay outside the .happ.
 *
 * @example
 * const db = await openOverlayDb('app-id', spec, seedSql);
 */
export async function openOverlayDb(
  appId: string,
  spec: AppSpec,
  seedSql?: string,
): Promise<Database> {
  const cached = openDbs.get(appId);
  if (cached) {
    return cached;
  }
  const SQL = await engine();
  const nativeBytes = await nativeReadOverlay(appId);
  const bytes = nativeBytes ?? (await idbGet(appId));
  const database = bytes ? new SQL.Database(bytes) : new SQL.Database();
  database.run(seedSqlFromSpec(null));
  const count = database.exec('SELECT COUNT(*) AS n FROM records');
  const empty = Number(count[0]?.values?.[0]?.[0] ?? 0) === 0;
  if (empty) {
    if (seedSql) {
      database.run(seedSql);
    } else {
      database.run(seedSqlFromSpec(spec));
    }
    migrateJsonOverlay(appId, database);
    await persist(appId, database);
  }
  openDbs.set(appId, database);
  return database;
}

function migrateJsonOverlay(appId: string, database: Database): void {
  const json = loadOverlay(appId);
  for (const [key, value] of Object.entries(json.kv)) {
    database.run('INSERT OR IGNORE INTO kv (key, json) VALUES (?, ?)', [
      key,
      JSON.stringify(value),
    ]);
  }
  for (const [collection, rows] of Object.entries(json.collections)) {
    for (const row of rows) {
      const id = String(row.id ?? crypto.randomUUID());
      database.run(
        'INSERT OR IGNORE INTO records (collection, id, json) VALUES (?, ?, ?)',
        [collection, id, JSON.stringify({ ...row, id })],
      );
    }
  }
}

async function save(appId: string, database: Database): Promise<void> {
  await persist(appId, database);
}

/**
 * Collection query used by runtime.db.query.
 *
 * @example
 * const rows = await dbQuery('app', spec, 'produits');
 */
export async function dbQuery(
  appId: string,
  spec: AppSpec,
  collection: string,
  seedSql?: string,
): Promise<Array<Record<string, unknown>>> {
  const database = await openOverlayDb(appId, spec, seedSql);
  const stmt = database.prepare('SELECT json FROM records WHERE collection = :c');
  stmt.bind({ ':c': collection });
  const rows: Array<Record<string, unknown>> = [];
  while (stmt.step()) {
    const raw = stmt.getAsObject().json;
    try {
      rows.push(JSON.parse(String(raw)) as Record<string, unknown>);
    } catch {
      /* skip bad row */
    }
  }
  stmt.free();
  return rows;
}

export async function dbUpsert(
  appId: string,
  spec: AppSpec,
  collection: string,
  record: Record<string, unknown>,
  seedSql?: string,
): Promise<Record<string, unknown>> {
  const database = await openOverlayDb(appId, spec, seedSql);
  const id = String(record.id ?? crypto.randomUUID());
  const next = { ...record, id };
  database.run(
    'INSERT OR REPLACE INTO records (collection, id, json) VALUES (?, ?, ?)',
    [collection, id, JSON.stringify(next)],
  );
  await save(appId, database);
  return next;
}

export async function dbRemove(
  appId: string,
  spec: AppSpec,
  collection: string,
  id: string,
  seedSql?: string,
): Promise<void> {
  const database = await openOverlayDb(appId, spec, seedSql);
  database.run('DELETE FROM records WHERE collection = ? AND id = ?', [
    collection,
    id,
  ]);
  await save(appId, database);
}

export async function kvGet(
  appId: string,
  spec: AppSpec,
  key: string,
  seedSql?: string,
): Promise<unknown> {
  const database = await openOverlayDb(appId, spec, seedSql);
  const stmt = database.prepare('SELECT json FROM kv WHERE key = :k');
  stmt.bind({ ':k': key });
  const value = stmt.step() ? stmt.getAsObject().json : null;
  stmt.free();
  return value == null ? null : JSON.parse(String(value));
}

export async function kvSet(
  appId: string,
  spec: AppSpec,
  key: string,
  value: unknown,
  seedSql?: string,
): Promise<void> {
  const database = await openOverlayDb(appId, spec, seedSql);
  database.run('INSERT OR REPLACE INTO kv (key, json) VALUES (?, ?)', [
    key,
    JSON.stringify(value ?? null),
  ]);
  await save(appId, database);
}

export async function kvRemove(
  appId: string,
  spec: AppSpec,
  key: string,
  seedSql?: string,
): Promise<void> {
  const database = await openOverlayDb(appId, spec, seedSql);
  database.run('DELETE FROM kv WHERE key = ?', [key]);
  await save(appId, database);
}

export async function kvList(
  appId: string,
  spec: AppSpec,
  seedSql?: string,
): Promise<string[]> {
  const database = await openOverlayDb(appId, spec, seedSql);
  const res = database.exec('SELECT key FROM kv');
  return (res[0]?.values ?? []).map((row) => String(row[0]));
}

/**
 * Drops sqlite overlays (IndexedDB + in-memory). Native files are overwritten empty on next open.
 *
 * @example
 * await clearSqliteOverlays();
 */
export async function clearSqliteOverlays(): Promise<void> {
  for (const db of openDbs.values()) {
    db.close();
  }
  openDbs.clear();
  try {
    const db = await idb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
