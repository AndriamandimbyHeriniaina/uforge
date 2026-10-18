import type { UfOp } from './uf-parser';

/** Text extensions the generation AI may write (doc/features/gateway.md). */
export const TEXT_EXTENSIONS = [
  'html', 'css', 'js', 'mjs', 'ts', 'tsx', 'jsx', 'json', 'svg', 'md', 'txt', 'csv',
];

export type WorkspaceFiles = Record<string, string>;

export type OpFailure = { path: string; reason: string };

export type ApplyResult = {
  files: WorkspaceFiles;
  failures: OpFailure[];
};

export type FileChange =
  | { op: 'write'; path: string; content: string }
  | { op: 'delete'; path: string };

/**
 * Validates a workspace path: relative, `/` separators, no `..`, allowed extension.
 *
 * @example
 * checkPath('src/main.js'); // null
 * checkPath('../etc/passwd'); // 'path must stay inside the project'
 */
export function checkPath(path: string, assets: Set<string> = new Set()): string | null {
  if (!path) {
    return 'empty path';
  }
  if (path.length > 200) {
    return 'path too long';
  }
  if (path.startsWith('/') || path.includes('\\') || /^[a-zA-Z]:/.test(path)) {
    return 'path must be relative to the project root';
  }
  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return 'path must stay inside the project';
  }
  if (!/^[\w./@+-]+$/.test(path)) {
    return 'path contains unsupported characters';
  }
  if (assets.has(path)) {
    return 'binary assets are read-only';
  }
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
  if (!TEXT_EXTENSIONS.includes(ext)) {
    return `extension .${ext || '?'} is not a writable text file`;
  }
  return null;
}

/**
 * Applies operations in order on a copy of the workspace. Never throws: every
 * problem is reported in `failures`, and the caller decides (atomic turn).
 *
 * @example
 * const { files, failures } = applyOps({ 'a.js': 'x' }, ops, new Set());
 */
export function applyOps(
  original: WorkspaceFiles,
  ops: UfOp[],
  assets: Set<string>,
): ApplyResult {
  const files: WorkspaceFiles = { ...original };
  const failures: OpFailure[] = [];
  for (const op of ops) {
    if (op.kind === 'write') {
      const problem = checkPath(op.path, assets);
      if (problem) {
        failures.push({ path: op.path, reason: problem });
        continue;
      }
      files[op.path] = op.content;
      continue;
    }
    if (op.kind === 'delete') {
      const problem = checkPath(op.path, assets);
      if (problem) {
        failures.push({ path: op.path, reason: problem });
        continue;
      }
      delete files[op.path];
      continue;
    }
    if (op.kind === 'rename') {
      const problem = checkPath(op.from, assets) ?? checkPath(op.to, assets);
      if (problem) {
        failures.push({ path: op.from, reason: problem });
        continue;
      }
      if (!(op.from in files)) {
        failures.push({ path: op.from, reason: 'cannot rename: file does not exist' });
        continue;
      }
      files[op.to] = files[op.from];
      delete files[op.from];
      continue;
    }
    const problem = checkPath(op.path, assets);
    if (problem) {
      failures.push({ path: op.path, reason: problem });
      continue;
    }
    const current = files[op.path];
    if (current === undefined) {
      failures.push({ path: op.path, reason: 'cannot edit: file does not exist (use uf-write)' });
      continue;
    }
    let next = current;
    let failed = false;
    for (const [index, pair] of op.pairs.entries()) {
      const replaced = replaceOnce(next, pair.search, pair.replace);
      if (typeof replaced !== 'string') {
        failures.push({ path: op.path, reason: `search block ${index + 1}: ${replaced.reason}` });
        failed = true;
        break;
      }
      next = replaced;
    }
    if (!failed) {
      files[op.path] = next;
    }
  }
  const manifest = files['uforge.json'];
  if (manifest !== undefined && manifest !== original['uforge.json']) {
    try {
      const parsed: unknown = JSON.parse(manifest);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        failures.push({ path: 'uforge.json', reason: 'uforge.json must be a JSON object' });
      }
    } catch (err) {
      failures.push({
        path: 'uforge.json',
        reason: `invalid JSON: ${err instanceof Error ? err.message : 'parse error'}`,
      });
    }
  }
  return { files, failures };
}

/**
 * Replaces exactly one occurrence. Falls back to a match that ignores trailing
 * spaces and CRLF, because models often lose them.
 *
 * @example
 * replaceOnce('a\nb\n', 'b', 'c'); // 'a\nc\n'
 */
export function replaceOnce(
  content: string,
  search: string,
  replace: string,
): string | { reason: string } {
  if (!search) {
    return { reason: 'empty search' };
  }
  const exact = countOccurrences(content, search);
  if (exact === 1) {
    const at = content.indexOf(search);
    return content.slice(0, at) + replace + content.slice(at + search.length);
  }
  if (exact > 1) {
    return { reason: `found ${exact} times, add more context so it is unique` };
  }
  const normalize = (value: string): string =>
    value.replace(/\r\n/g, '\n').split('\n').map((line) => line.replace(/[ \t]+$/, '')).join('\n');
  const loose = normalize(content);
  const looseSearch = normalize(search);
  const looseCount = countOccurrences(loose, looseSearch);
  if (looseCount === 1) {
    const at = loose.indexOf(looseSearch);
    return loose.slice(0, at) + replace + loose.slice(at + looseSearch.length);
  }
  if (looseCount > 1) {
    return { reason: `found ${looseCount} times, add more context so it is unique` };
  }
  return { reason: 'not found in the current file' };
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  while (true) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) {
      return count;
    }
    count += 1;
    from = at + needle.length;
  }
}

/**
 * Final diff of a turn: full content of every written or edited file, plus deletions.
 *
 * @example
 * diffFiles({ 'a.js': '1' }, { 'a.js': '2', 'b.js': '3' });
 * // [{ op: 'write', path: 'a.js', content: '2' }, { op: 'write', path: 'b.js', content: '3' }]
 */
export function diffFiles(before: WorkspaceFiles, after: WorkspaceFiles): FileChange[] {
  const changes: FileChange[] = [];
  for (const [path, content] of Object.entries(after)) {
    if (before[path] !== content) {
      changes.push({ op: 'write', path, content });
    }
  }
  for (const path of Object.keys(before)) {
    if (!(path in after)) {
      changes.push({ op: 'delete', path });
    }
  }
  return changes.sort((a, b) => a.path.localeCompare(b.path));
}
