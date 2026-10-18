import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CDN = (process.env.ESM_CDN ?? 'https://esm.sh').replace(/\/$/, '');
const CACHE_DIR = process.env.COMPILER_CACHE_DIR ?? join(tmpdir(), 'uforge-compiler-cache');
const memory = new Map();

/**
 * Splits a bare import into package name and subpath.
 *
 * @example
 * parseSpecifier('@fontsource/inter/400.css'); // { name: '@fontsource/inter', subpath: '/400.css' }
 */
export function parseSpecifier(spec) {
  const parts = spec.split('/');
  const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  return { name, subpath: spec.slice(name.length) };
}

/**
 * CDN URL of a bare import, pinned to the version declared in uforge.json.
 * Every other declared dependency is passed as `deps` so shared packages
 * (preact, react…) resolve to one copy.
 *
 * @example
 * npmUrl('chart.js/auto', { 'chart.js': '4.4.1' });
 * // 'https://esm.sh/chart.js@4.4.1/auto?target=es2020'
 */
export function npmUrl(spec, dependencies) {
  const { name, subpath } = parseSpecifier(spec);
  const version = dependencies?.[name];
  if (!version) {
    throw new Error(
      `Le paquet « ${name} » n’est pas déclaré dans uforge.json → dependencies (version exacte).`,
    );
  }
  const deps = Object.entries(dependencies)
    .filter(([dep]) => dep !== name)
    .map(([dep, depVersion]) => `${dep}@${depVersion}`)
    .join(',');
  const query = `target=es2020${deps ? `&deps=${deps}` : ''}`;
  return `${CDN}/${name}@${version}${subpath}?${query}`;
}

/**
 * Downloads a CDN module once; memory then disk cache keyed by URL.
 *
 * @example
 * const { contents, contentType } = await fetchCached('https://esm.sh/preact@10.24.3');
 */
export async function fetchCached(url) {
  const hit = memory.get(url);
  if (hit) {
    return hit;
  }
  const key = createHash('sha256').update(url).digest('hex');
  const bodyPath = join(CACHE_DIR, `${key}.bin`);
  const metaPath = join(CACHE_DIR, `${key}.json`);
  try {
    const [contents, meta] = await Promise.all([readFile(bodyPath), readFile(metaPath, 'utf8')]);
    const entry = { contents: new Uint8Array(contents), ...JSON.parse(meta) };
    memory.set(url, entry);
    return entry;
  } catch {
    /* not cached yet */
  }
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: { 'user-agent': 'uforge-compiler' },
  });
  if (!response.ok) {
    throw new Error(`Téléchargement impossible : ${url} (HTTP ${response.status})`);
  }
  const entry = {
    contents: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? '',
  };
  memory.set(url, entry);
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await Promise.all([
      writeFile(bodyPath, entry.contents),
      writeFile(metaPath, JSON.stringify({ contentType: entry.contentType })),
    ]);
  } catch {
    /* cache is best effort */
  }
  return entry;
}
