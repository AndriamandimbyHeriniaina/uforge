import { MAX_VERSIONS } from '../config';
import { sha256Hex, utf8 } from '../lib/bytes';
import type { AdminBlock, Asset, FileChange, Snapshot, VersionEntry, Workspace } from './types';

/**
 * Starter project: one screen that invites the admin to describe the app.
 * The generation AI replaces it on the first turn.
 *
 * @example
 * const ws = templateWorkspace();
 */
export function templateWorkspace(): Workspace {
  return {
    assets: {},
    files: {
      'uforge.json': `${JSON.stringify(
        {
          name: 'Mon application',
          description: '',
          icon: 'assets/icon.svg',
          entry: 'index.html',
          orientation: 'any',
          capabilities: [],
          dependencies: {},
          jsx: null,
        },
        null,
        2,
      )}\n`,
      'assets/icon.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#d4894a"/><path d="M20 16v20a12 12 0 0 0 24 0V16" fill="none" stroke="#fff8f0" stroke-width="6" stroke-linecap="round"/></svg>\n',
      'index.html': `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Mon application</title>
    <link rel="stylesheet" href="./src/styles.css" />
  </head>
  <body>
    <main class="empty">
      <div class="mark">U</div>
      <h1>Ton appli commence ici</h1>
      <p>Décris à Uforge ce que tu veux : un jeu, une gestion de stock, une vitrine… tout ce qui te passe par la tête.</p>
    </main>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
`,
      'src/main.js': "document.documentElement.dataset.ready = 'true';\n",
      'src/styles.css': `:root { color-scheme: light dark; }
body {
  margin: 0;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  background: #f6f1ea;
  color: #1f1a15;
  font: 16px/1.5 ui-sans-serif, system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { body { background: #14110e; color: #f3eee6; } }
.empty { max-width: 420px; padding: 32px 24px; text-align: center; }
.mark {
  width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 20px;
  display: grid; place-items: center; font-size: 30px; font-family: Georgia, serif;
  background: #d4894a; color: #fff8f0;
}
h1 { margin: 0 0 8px; font-size: 1.5rem; }
p { margin: 0; opacity: 0.75; }
`,
    },
  };
}

async function hashText(content: string): Promise<string> {
  return sha256Hex(utf8(content));
}

async function hashAsset(asset: Asset): Promise<string> {
  return sha256Hex(utf8(`${asset.mime}:${asset.dataBase64}`));
}

/**
 * Stores the workspace contents in the admin blobs and returns path → hash.
 *
 * @example
 * admin.current = await snapshot(admin, ws);
 */
export async function snapshot(admin: AdminBlock, ws: Workspace): Promise<Snapshot> {
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(ws.files)) {
    const hash = await hashText(content);
    admin.blobs[hash] = content;
    files[path] = hash;
  }
  const assets: Record<string, string> = {};
  for (const [path, asset] of Object.entries(ws.assets)) {
    const hash = await hashAsset(asset);
    admin.assetBlobs[hash] = asset;
    assets[path] = hash;
  }
  return { files, assets };
}

/**
 * Snapshot → workspace.
 *
 * @example
 * const ws = materialize(admin, admin.current);
 */
export function materialize(admin: AdminBlock, snap: Snapshot): Workspace {
  const files: Record<string, string> = {};
  for (const [path, hash] of Object.entries(snap.files)) {
    const content = admin.blobs[hash];
    if (content !== undefined) {
      files[path] = content;
    }
  }
  const assets: Record<string, Asset> = {};
  for (const [path, hash] of Object.entries(snap.assets)) {
    const asset = admin.assetBlobs[hash];
    if (asset) {
      assets[path] = asset;
    }
  }
  return { files, assets };
}

/**
 * Fresh admin block: the starter project is version 1.
 *
 * @example
 * const admin = await newAdminBlock();
 */
export async function newAdminBlock(): Promise<AdminBlock> {
  const admin: AdminBlock = {
    format: 1,
    current: { files: {}, assets: {} },
    currentVersion: 0,
    builtVersion: 0,
    versions: [],
    blobs: {},
    assetBlobs: {},
    conversation: [],
    settings: { previewData: 'live' },
  };
  await commitVersion(admin, templateWorkspace(), 'Projet de départ');
  return admin;
}

/**
 * Records the workspace as a new version (keeps the last MAX_VERSIONS).
 *
 * @example
 * const n = await commitVersion(admin, ws, 'Ajoute un panier');
 */
export async function commitVersion(admin: AdminBlock, ws: Workspace, message: string): Promise<number> {
  const snap = await snapshot(admin, ws);
  const n = (admin.versions[admin.versions.length - 1]?.n ?? 0) + 1;
  const entry: VersionEntry = { n, at: new Date().toISOString(), message: message.slice(0, 200), ...snap };
  admin.versions.push(entry);
  if (admin.versions.length > MAX_VERSIONS) {
    admin.versions.splice(0, admin.versions.length - MAX_VERSIONS);
  }
  admin.current = snap;
  admin.currentVersion = n;
  collectGarbage(admin);
  return n;
}

/**
 * « Revenir à cette version » : creates a new version identical to an old one.
 *
 * @example
 * await restoreVersion(admin, 3);
 */
export async function restoreVersion(admin: AdminBlock, n: number): Promise<number> {
  const entry = admin.versions.find((version) => version.n === n);
  if (!entry) {
    throw new Error('Version introuvable');
  }
  return commitVersion(admin, materialize(admin, entry), `Retour à la version ${n}`);
}

/**
 * Drops blobs no snapshot references anymore.
 *
 * @example
 * collectGarbage(admin);
 */
export function collectGarbage(admin: AdminBlock): void {
  const text = new Set<string>(Object.values(admin.current.files));
  const binary = new Set<string>(Object.values(admin.current.assets));
  for (const version of admin.versions) {
    Object.values(version.files).forEach((hash) => text.add(hash));
    Object.values(version.assets).forEach((hash) => binary.add(hash));
  }
  for (const hash of Object.keys(admin.blobs)) {
    if (!text.has(hash)) {
      delete admin.blobs[hash];
    }
  }
  for (const hash of Object.keys(admin.assetBlobs)) {
    if (!binary.has(hash)) {
      delete admin.assetBlobs[hash];
    }
  }
}

/**
 * Applies the `done.changes` of a turn (full contents, deletions).
 *
 * @example
 * const next = applyChanges(ws, done.changes);
 */
export function applyChanges(ws: Workspace, changes: FileChange[]): Workspace {
  const files = { ...ws.files };
  for (const change of changes) {
    if (change.op === 'write') {
      files[change.path] = change.content;
    } else {
      delete files[change.path];
    }
  }
  return { files, assets: ws.assets };
}

/**
 * Display name of the app from uforge.json.
 *
 * @example
 * appNameOf(ws); // 'Ma boutique'
 */
export function appNameOf(ws: Workspace): string {
  try {
    const manifest = JSON.parse(ws.files['uforge.json'] ?? '{}') as { name?: unknown };
    return typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim() : 'Mon application';
  } catch {
    return 'Mon application';
  }
}

/**
 * Unique asset path for an attached file: assets/<slug>.<ext>.
 *
 * @example
 * assetPathFor(ws, 'Photo vitrine.JPG', 'image/jpeg'); // 'assets/photo-vitrine.jpg'
 */
export function assetPathFor(ws: Workspace, name: string, mime: string): string {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg';
  const stem =
    name
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'image';
  let path = `assets/${stem}.${ext}`;
  let i = 2;
  while (ws.assets[path] || ws.files[path]) {
    path = `assets/${stem}-${i}.${ext}`;
    i += 1;
  }
  return path;
}
