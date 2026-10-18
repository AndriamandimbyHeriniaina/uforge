import initSqlJs, { type BindParams, type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { RuntimeCallError } from './errors';

let engine: Promise<SqlJsStatic> | null = null;

function sqlEngine(): Promise<SqlJsStatic> {
  if (!engine) {
    engine = initSqlJs({ locateFile: () => wasmUrl });
    engine.catch(() => {
      engine = null;
    });
  }
  return engine;
}

const RESERVED = /\b(from|into|table|update|join|exists)\s+["'`[]?_/i;

export type Persist = (bytes: Uint8Array) => Promise<void>;

/** Public surface of the app database (what the bridge and the iframe use). */
export interface AppDatabaseApi {
  query(sql: string, params?: unknown): Array<Record<string, unknown>>;
  exec(sql: string, params?: unknown): { changes: number; lastInsertId: number };
  batch(statements: unknown): Array<{ changes: number; lastInsertId: number }>;
  migrate(steps: unknown): number;
  kvGet(key: string): unknown;
  kvSet(key: string, value: unknown): void;
  kvRemove(key: string): void;
  kvKeys(): string[];
  localStorageSnapshot(): Record<string, string>;
}

/**
 * The single SQLite database of an app (doc/features/data.md), held by the host.
 * `runtime.storage` lives in the reserved `_kv` table. Every write is persisted
 * through `persist` with a short debounce; `flush()` forces it.
 *
 * @example
 * const db = await AppDatabase.open(bytes, (data) => writeLiveDb(appId, data));
 * await db.migrate(['CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT)']);
 */
export class AppDatabase implements AppDatabaseApi {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private closed = false;

  private constructor(
    private readonly db: Database,
    private readonly persist: Persist,
  ) {}

  static async open(bytes: Uint8Array | null, persist: Persist): Promise<AppDatabase> {
    const SQL = await sqlEngine();
    const db = bytes && bytes.length ? new SQL.Database(bytes) : new SQL.Database();
    db.run('CREATE TABLE IF NOT EXISTS _kv (key TEXT PRIMARY KEY, json TEXT NOT NULL)');
    return new AppDatabase(db, persist);
  }

  /**
   * SELECT → array of row objects.
   *
   * @example
   * await db.query('SELECT * FROM notes WHERE id = ?', [1]);
   */
  query(sql: string, params?: unknown): Array<Record<string, unknown>> {
    this.guard(sql);
    const stmt = this.prepare(sql, params);
    const rows: Array<Record<string, unknown>> = [];
    try {
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Record<string, unknown>);
      }
    } finally {
      stmt.free();
    }
    return rows;
  }

  /**
   * INSERT / UPDATE / DELETE / DDL → `{ changes, lastInsertId }`.
   *
   * @example
   * db.exec('INSERT INTO notes (text) VALUES (?)', ['salut']);
   */
  exec(sql: string, params?: unknown): { changes: number; lastInsertId: number } {
    this.guard(sql);
    const stmt = this.prepare(sql, params);
    try {
      while (stmt.step()) {
        /* drain RETURNING rows */
      }
    } finally {
      stmt.free();
    }
    const result = { changes: this.db.getRowsModified(), lastInsertId: this.lastInsertId() };
    this.schedule();
    return result;
  }

  /**
   * Runs statements in one transaction.
   *
   * @example
   * db.batch([{ sql: 'DELETE FROM notes' }, { sql: 'INSERT INTO notes (text) VALUES (?)', params: ['a'] }]);
   */
  batch(statements: unknown): Array<{ changes: number; lastInsertId: number }> {
    if (!Array.isArray(statements)) {
      throw new RuntimeCallError('invalid', 'batch attend un tableau de { sql, params }');
    }
    const results: Array<{ changes: number; lastInsertId: number }> = [];
    this.db.run('BEGIN');
    try {
      for (const entry of statements as Array<{ sql?: unknown; params?: unknown }>) {
        if (typeof entry?.sql !== 'string') {
          throw new RuntimeCallError('invalid', 'chaque entrée de batch doit avoir un champ sql');
        }
        this.guard(entry.sql);
        const stmt = this.prepare(entry.sql, entry.params);
        try {
          while (stmt.step()) {
            /* drain */
          }
        } finally {
          stmt.free();
        }
        results.push({ changes: this.db.getRowsModified(), lastInsertId: this.lastInsertId() });
      }
      this.db.run('COMMIT');
    } catch (err) {
      this.db.run('ROLLBACK');
      throw toCallError(err);
    }
    this.schedule();
    return results;
  }

  /**
   * Append-only schema steps, tracked with PRAGMA user_version.
   *
   * @example
   * db.migrate(['CREATE TABLE t (id INTEGER PRIMARY KEY)', 'ALTER TABLE t ADD COLUMN name TEXT']);
   */
  migrate(steps: unknown): number {
    if (!Array.isArray(steps) || steps.some((step) => typeof step !== 'string' && !Array.isArray(step))) {
      throw new RuntimeCallError('invalid', 'migrate attend un tableau de requêtes SQL');
    }
    const current = Number(this.db.exec('PRAGMA user_version')[0]?.values[0]?.[0] ?? 0);
    for (let index = current; index < steps.length; index += 1) {
      const step = steps[index] as string | string[];
      const statements = Array.isArray(step) ? step : [step];
      this.db.run('BEGIN');
      try {
        for (const sql of statements) {
          if (typeof sql !== 'string') {
            throw new RuntimeCallError('invalid', `étape ${index + 1} : requête invalide`);
          }
          this.guard(sql);
          this.db.exec(sql);
        }
        this.db.run(`PRAGMA user_version = ${index + 1}`);
        this.db.run('COMMIT');
      } catch (err) {
        this.db.run('ROLLBACK');
        throw new RuntimeCallError('invalid', `Migration ${index + 1} : ${toCallError(err).message}`);
      }
    }
    if (steps.length > current) {
      this.schedule();
    }
    return Math.max(current, steps.length);
  }

  kvGet(key: string): unknown {
    const row = this.rawQuery('SELECT json FROM _kv WHERE key = ?', [key])[0];
    return row ? JSON.parse(String(row.json)) : null;
  }

  kvSet(key: string, value: unknown): void {
    const json = JSON.stringify(value ?? null);
    if (json === undefined) {
      throw new RuntimeCallError('invalid', 'valeur non sérialisable en JSON');
    }
    this.db.run('INSERT OR REPLACE INTO _kv (key, json) VALUES (?, ?)', [key, json]);
    this.schedule();
  }

  kvRemove(key: string): void {
    this.db.run('DELETE FROM _kv WHERE key = ?', [key]);
    this.schedule();
  }

  kvKeys(): string[] {
    return this.rawQuery("SELECT key FROM _kv WHERE key NOT LIKE 'ls:%' ORDER BY key").map((row) =>
      String(row.key),
    );
  }

  /** Values of the localStorage shim (`ls:` prefix), preloaded into the guest. */
  localStorageSnapshot(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const row of this.rawQuery("SELECT key, json FROM _kv WHERE key LIKE 'ls:%'")) {
      const value = JSON.parse(String(row.json));
      out[String(row.key).slice(3)] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return out;
  }

  export(): Uint8Array {
    return this.db.export();
  }

  /** Persists pending writes now (before export, Builder, background). */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.saving = this.saving.then(() => this.persist(this.db.export())).catch(() => undefined);
    }
    await this.saving;
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    await this.flush();
    this.closed = true;
    this.db.close();
  }

  private schedule(): void {
    if (this.closed) {
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.saving = this.saving.then(() => this.persist(this.db.export())).catch(() => undefined);
    }, 400);
  }

  private rawQuery(sql: string, params?: SqlValue[]): Array<Record<string, unknown>> {
    const stmt = this.db.prepare(sql);
    const rows: Array<Record<string, unknown>> = [];
    try {
      if (params) {
        stmt.bind(params);
      }
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Record<string, unknown>);
      }
    } finally {
      stmt.free();
    }
    return rows;
  }

  private prepare(sql: string, params: unknown) {
    try {
      const stmt = this.db.prepare(sql);
      const bound = toBindParams(params);
      if (bound) {
        stmt.bind(bound);
      }
      return stmt;
    } catch (err) {
      throw toCallError(err);
    }
  }

  private lastInsertId(): number {
    return Number(this.db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? 0);
  }

  private guard(sql: string): void {
    if (typeof sql !== 'string' || !sql.trim()) {
      throw new RuntimeCallError('invalid', 'requête SQL vide');
    }
    if (RESERVED.test(sql) || /\b_kv\b/i.test(sql)) {
      throw new RuntimeCallError('invalid', 'les tables commençant par « _ » sont réservées au Runtime');
    }
  }
}

function toBindParams(params: unknown): BindParams | null {
  if (params === undefined || params === null) {
    return null;
  }
  const convert = (value: unknown): SqlValue => {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    if (typeof value === 'number' || typeof value === 'string' || value instanceof Uint8Array) {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return JSON.stringify(value);
  };
  if (Array.isArray(params)) {
    return params.map(convert);
  }
  if (typeof params === 'object') {
    const named: Record<string, SqlValue> = {};
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      named[/^[:@$]/.test(key) ? key : `:${key}`] = convert(value);
    }
    return named;
  }
  throw new RuntimeCallError('invalid', 'params doit être un tableau ou un objet');
}

function toCallError(err: unknown): RuntimeCallError {
  if (err instanceof RuntimeCallError) {
    return err;
  }
  return new RuntimeCallError('invalid', err instanceof Error ? err.message : String(err));
}
