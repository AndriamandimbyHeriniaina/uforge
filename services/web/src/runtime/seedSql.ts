import type { AppSpec } from './types';

/**
 * Builds SQLite seed statements from a Builder spec (preview before compile).
 *
 * @example
 * db.run(seedSqlFromSpec(spec));
 */
export function seedSqlFromSpec(spec: AppSpec | null | undefined): string {
  const lines = [
    `CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      json TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );`,
    `CREATE TABLE IF NOT EXISTS kv (
      key TEXT NOT NULL PRIMARY KEY,
      json TEXT NOT NULL
    );`,
  ];
  const seed = spec?.seed && typeof spec.seed === 'object' ? spec.seed : {};
  for (const [collection, rows] of Object.entries(seed)) {
    if (!Array.isArray(rows)) {
      continue;
    }
    rows.forEach((row, index) => {
      const rec =
        row && typeof row === 'object'
          ? { ...(row as Record<string, unknown>) }
          : { title: String(row) };
      rec.id = String(rec.id ?? `seed-${index + 1}`);
      lines.push(
        `INSERT OR IGNORE INTO records (collection, id, json) VALUES (${sqlString(
          collection,
        )}, ${sqlString(String(rec.id))}, ${sqlString(JSON.stringify(rec))});`,
      );
    });
  }
  return lines.join('\n');
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
