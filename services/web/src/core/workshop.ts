import { strToU8, zipSync, type Zippable } from 'fflate';
import { markRaw, reactive, toRaw } from 'vue';
import { MAX_TURNS } from '../config';
import { fromBase64, parseDataUrl } from '../lib/bytes';
import { AppDatabase } from '../runtime/database';
import { readAsDataUrl, resizeImage } from '../runtime/native';
import { buildWorkspace, type BuildOk } from './compiler';
import { readLiveDb, readPreviewDb, writeBuild, writePreviewDb, clearAppData } from './device';
import { generate, GatewayError, type GeneratePayload } from './gateway';
import { adminBlock, adminKey, markOffline, saveAdmin, session, sessionToken, touch } from './session';
import { shell } from './state';
import type { ChatOp, ChatTurn, HappHeader, PendingAttachment, RuntimeErrorItem, Workspace } from './types';
import {
  applyChanges,
  appNameOf,
  assetPathFor,
  commitVersion,
  materialize,
  restoreVersion,
} from './workspace';

type Preview = { html: string; manifest: BuildOk['manifest']; warnings: string[] };

/**
 * Workshop state (doc/features/builder.md). The workspace and the preview
 * build are raw objects; `rev` bumps when they change.
 */
export const workshop = reactive({
  ready: false,
  rev: 0,
  workspace: markRaw({ files: {}, assets: {} }) as Workspace,
  conversation: [] as ChatTurn[],
  versions: [] as Array<{ n: number; at: string; message: string }>,
  currentVersion: 0,
  builtVersion: 0,
  busy: false,
  building: false,
  preview: null as Preview | null,
  previewDb: null as AppDatabase | null,
  previewKey: 0,
  previewData: 'live' as 'live' | 'empty',
  errors: [] as RuntimeErrorItem[],
  attachments: [] as PendingAttachment[],
});

let abort: AbortController | null = null;

function appId(): string {
  if (!shell.header) {
    throw new Error('Aucune appli');
  }
  return shell.header.appId;
}

function syncFromAdmin(): void {
  const admin = adminBlock();
  workshop.workspace = markRaw(materialize(admin, admin.current));
  workshop.versions = admin.versions.map(({ n, at, message }) => ({ n, at, message })).reverse();
  workshop.currentVersion = admin.currentVersion;
  workshop.builtVersion = admin.builtVersion;
  workshop.rev += 1;
}

async function persist(): Promise<void> {
  const admin = adminBlock();
  if (workshop.conversation.length > MAX_TURNS) {
    workshop.conversation.splice(0, workshop.conversation.length - MAX_TURNS);
  }
  admin.conversation = toRaw(workshop.conversation).map((turn) => ({
    ...toRaw(turn),
    ops: turn.ops?.map((op) => ({ ...toRaw(op) })),
  }));
  admin.settings.previewData = workshop.previewData;
  await saveAdmin();
}

/**
 * Loads the admin block into the workshop and builds the first preview.
 *
 * @example
 * await openWorkshop();
 */
export async function openWorkshop(): Promise<void> {
  const admin = adminBlock();
  workshop.conversation = admin.conversation.map((turn) =>
    turn.status === 'streaming' ? { ...turn, status: 'failed', error: 'Tour interrompu.' } : turn,
  );
  workshop.previewData = admin.settings?.previewData ?? 'live';
  workshop.errors = [];
  workshop.attachments = [];
  workshop.preview = null;
  syncFromAdmin();
  await openPreviewDb(false);
  workshop.ready = true;
  await rebuildPreview();
}

async function openPreviewDb(reset: boolean): Promise<void> {
  await workshop.previewDb?.close();
  const id = appId();
  const key = adminKey();
  // « Vraies données » : a fresh copy of the live base each time the workshop opens.
  // Before the first Builder (no live base) or in « Base vide », the preview base is kept.
  let bytes = workshop.previewData === 'live' ? await readLiveDb(id) : null;
  if (!bytes && !reset) {
    bytes = await readPreviewDb(id, key);
  }
  if (reset) {
    await writePreviewDb(id, key, bytes);
  }
  workshop.previewDb = markRaw(await AppDatabase.open(bytes, (data) => writePreviewDb(id, key, data)));
  workshop.previewKey += 1;
}

/**
 * « Repartir des vraies données » / « Base vide » for the preview.
 *
 * @example
 * await resetPreviewData('empty');
 */
export async function resetPreviewData(kind: 'live' | 'empty'): Promise<void> {
  workshop.previewData = kind;
  await openPreviewDb(true);
  await persist();
}

/**
 * Compiles the draft in preview mode and refreshes the iframe.
 *
 * @example
 * await rebuildPreview();
 */
export async function rebuildPreview(): Promise<void> {
  workshop.building = true;
  try {
    const out = await buildWorkspace('preview', workshop.workspace);
    workshop.errors = workshop.errors.filter((error) => error.source !== 'build');
    if (out.status === 'ok') {
      workshop.errors = [];
      workshop.preview = markRaw({ html: out.html, manifest: out.manifest, warnings: out.warnings });
      workshop.previewKey += 1;
    } else {
      workshop.errors = out.errors.map((error) => ({
        source: 'build' as const,
        message: error.message,
        file: error.file,
        line: error.line,
      }));
    }
  } finally {
    workshop.building = false;
  }
}

/**
 * Error reported by the preview iframe (deduplicated, at most 20).
 *
 * @example
 * addRuntimeError({ source: 'runtime', message: 'x is not a function' });
 */
export function addRuntimeError(error: RuntimeErrorItem): void {
  const key = `${error.file ?? ''}:${error.message}`;
  if (workshop.errors.some((item) => `${item.file ?? ''}:${item.message}` === key)) {
    return;
  }
  if (workshop.errors.length < 20) {
    workshop.errors.push(error);
  }
}

/**
 * Adds files picked in the composer: images are resized, text files read.
 *
 * @example
 * await addAttachments(input.files);
 */
export async function addAttachments(files: File[]): Promise<string[]> {
  const problems: string[] = [];
  for (const file of files) {
    if (workshop.attachments.length >= 6) {
      problems.push('6 pièces jointes au maximum par message.');
      break;
    }
    const id = crypto.randomUUID();
    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
      const original = await readAsDataUrl(file);
      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const small = await resizeImage(original, 1600, 0.85, mime);
      const parsed = parseDataUrl(small.dataUrl);
      if (!parsed) {
        problems.push(`${file.name} : image illisible.`);
        continue;
      }
      workshop.attachments.push({
        id,
        name: file.name,
        kind: 'image',
        mime: parsed.mime,
        size: Math.round((parsed.base64.length * 3) / 4),
        dataBase64: parsed.base64,
        useInApp: true,
        previewUrl: small.dataUrl,
      });
      continue;
    }
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
      problems.push(`${file.name} : enregistre la feuille en CSV puis joins le CSV.`);
      continue;
    }
    if (file.size > 400_000) {
      problems.push(`${file.name} : fichier texte trop gros (400 Ko max).`);
      continue;
    }
    const content = await file.text();
    workshop.attachments.push({
      id,
      name: file.name,
      kind: 'text',
      mime: file.type || 'text/plain',
      size: file.size,
      content,
      useInApp: false,
    });
  }
  return problems;
}

/**
 * One conversation turn (doc/features/builder.md § Conversation).
 *
 * @example
 * await sendMessage('Ajoute un panier avec le total');
 */
export async function sendMessage(message: string): Promise<void> {
  const text = message.trim();
  if (!text || workshop.busy) {
    return;
  }
  touch();
  if (!session.online || !sessionToken()) {
    workshop.conversation.push({
      role: 'assistant',
      text: '',
      at: new Date().toISOString(),
      status: 'failed',
      error: session.warning || 'L’IA n’est pas disponible : rouvre l’atelier une fois en ligne.',
    });
    return;
  }

  const attachments = workshop.attachments.splice(0);
  let workspace: Workspace = { files: { ...workshop.workspace.files }, assets: { ...workshop.workspace.assets } };
  const payloadAttachments: GeneratePayload['attachments'] = [];
  for (const attachment of attachments) {
    let assetPath: string | undefined;
    if (attachment.kind === 'image' && attachment.useInApp && attachment.dataBase64) {
      assetPath = assetPathFor(workspace, attachment.name, attachment.mime);
      workspace.assets[assetPath] = { mime: attachment.mime, dataBase64: attachment.dataBase64, size: attachment.size };
    }
    payloadAttachments.push({
      name: attachment.name,
      kind: attachment.kind,
      mime: attachment.mime,
      ...(attachment.dataBase64 ? { dataBase64: attachment.dataBase64 } : {}),
      ...(attachment.content !== undefined ? { content: attachment.content } : {}),
      ...(assetPath ? { assetPath } : {}),
    });
  }

  const history = workshop.conversation
    .filter((turn) => turn.text.trim())
    .slice(-20)
    .map((turn) => ({ role: turn.role, text: turn.text }));
  workshop.conversation.push({
    role: 'user',
    text,
    at: new Date().toISOString(),
    attachments: attachments.map((attachment) => attachment.name),
  });
  workshop.conversation.push({ role: 'assistant', text: '', at: new Date().toISOString(), status: 'streaming', ops: [] });
  const reply = workshop.conversation[workshop.conversation.length - 1];

  workshop.busy = true;
  abort = new AbortController();
  let changed = false;
  try {
    const done = await generate(
      sessionToken(),
      {
        appId: appId(),
        message: text,
        files: Object.entries(workspace.files).map(([path, content]) => ({ path, content })),
        assets: Object.entries(workspace.assets).map(([path, asset]) => ({ path, mime: asset.mime, size: asset.size })),
        attachments: payloadAttachments,
        errors: workshop.errors.slice(0, 20).map((error) => ({ ...toRaw(error) })),
        conversation: history,
      },
      {
        onToken: (delta) => {
          reply.text += delta;
          touch();
        },
        onOp: (event) => {
          const ops = (reply.ops ??= []);
          const existing = ops.find((op: ChatOp) => op.path === event.path && op.op === event.op && !op.done);
          if (event.phase === 'start' && !existing) {
            ops.push({ op: event.op, path: event.path, done: false });
          } else if (event.phase === 'end') {
            if (existing) {
              existing.done = true;
            } else {
              ops.push({ op: event.op, path: event.path, done: true });
            }
          }
        },
      },
      abort.signal,
    );
    if (done.status === 'SUCCEEDED') {
      const hasNewAssets = payloadAttachments.some((attachment) => attachment.assetPath);
      if (done.changes.length || hasNewAssets) {
        workspace = applyChanges(workspace, done.changes);
        const n = await commitVersion(adminBlock(), workspace, text);
        reply.version = n;
        syncFromAdmin();
        changed = true;
      }
      reply.text = done.reply || reply.text.trim() || 'C’est fait.';
      reply.status = 'ok';
      reply.ops?.forEach((op) => (op.done = true));
    } else if (done.status === 'REFUSED') {
      reply.text = done.reply || reply.text;
      reply.status = 'refused';
    } else {
      reply.status = 'failed';
      reply.error = done.message ?? 'Le tour a échoué.';
      reply.ops = [];
      workshop.attachments.unshift(...attachments);
    }
  } catch (err) {
    reply.status = 'failed';
    reply.error = err instanceof Error ? err.message : 'Erreur inconnue';
    reply.ops = [];
    workshop.attachments.unshift(...attachments);
    if (err instanceof GatewayError && err.status === 401) {
      markOffline(err.message);
    }
  } finally {
    abort = null;
    workshop.busy = false;
    await persist();
  }
  if (changed) {
    workshop.errors = [];
    await rebuildPreview();
  }
}

/** Stops the current turn. */
export function stopTurn(): void {
  abort?.abort();
}

/**
 * Sends the reported errors to the AI (bouton « Corriger »).
 *
 * @example
 * await fixErrors();
 */
export function fixErrors(): Promise<void> {
  return sendMessage('Corrige les problèmes signalés par l’aperçu, sans rien changer d’autre.');
}

/**
 * « Revenir à cette version ».
 *
 * @example
 * await restore(3);
 */
export async function restore(n: number): Promise<void> {
  const created = await restoreVersion(adminBlock(), n);
  workshop.conversation.push({
    role: 'assistant',
    text: `Retour à la version ${n} (enregistrée comme version ${created}).`,
    at: new Date().toISOString(),
    status: 'ok',
    version: created,
  });
  syncFromAdmin();
  await persist();
  await rebuildPreview();
}

/**
 * « Builder » : production build → live app (doc/features/builder.md § Builder).
 * Returns the build errors, or null on success.
 *
 * @example
 * const errors = await builder();
 */
export async function builder(): Promise<string[] | null> {
  const header = shell.header;
  if (!header) {
    return ['Aucune appli'];
  }
  const out = await buildWorkspace('production', workshop.workspace);
  if (out.status !== 'ok') {
    workshop.errors = out.errors.map((error) => ({
      source: 'build' as const,
      message: error.message,
      file: error.file,
      line: error.line,
    }));
    return out.errors.map((error) => error.message);
  }
  const builtAt = new Date().toISOString();
  // shell.header is reactive: nested proxies cannot be structured-cloned into IndexedDB.
  const next: HappHeader = {
    ...(JSON.parse(JSON.stringify(toRaw(header))) as HappHeader),
    name: out.manifest.name || appNameOf(workshop.workspace),
    description: out.manifest.description,
    icon: out.manifest.icon,
    capabilities: out.manifest.capabilities,
    version: workshop.currentVersion,
    builtAt,
  };
  await writeBuild(next, { html: out.html, manifest: out.manifest, version: workshop.currentVersion, builtAt });
  shell.header = next;
  adminBlock().builtVersion = workshop.currentVersion;
  workshop.builtVersion = workshop.currentVersion;
  await persist();
  return null;
}

/**
 * Source code of the draft as a .zip (admin only: the workshop is open).
 *
 * @example
 * const { bytes, fileName } = await exportSources();
 */
export async function exportSources(): Promise<{ bytes: Uint8Array; fileName: string }> {
  const ws = workshop.workspace;
  const folder = slugify(appNameOf(ws));
  const entries: Zippable = {};
  for (const [path, content] of Object.entries(ws.files)) {
    entries[`${folder}/${path}`] = strToU8(content);
  }
  for (const [path, asset] of Object.entries(ws.assets)) {
    entries[`${folder}/${path}`] = [fromBase64(asset.dataBase64), { level: 0 }];
  }
  return { bytes: zipSync(entries), fileName: `${folder}-v${workshop.currentVersion}-code.zip` };
}

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'mon-appli'
  );
}

/**
 * « Vider les données » : live and preview databases.
 *
 * @example
 * await clearData();
 */
export async function clearData(): Promise<void> {
  await workshop.previewDb?.close();
  workshop.previewDb = null;
  await clearAppData();
  await openPreviewDb(true);
}

/**
 * Flushes and releases the workshop before the session closes.
 *
 * @example
 * await disposeWorkshop();
 */
export async function disposeWorkshop(): Promise<void> {
  abort?.abort();
  if (workshop.ready) {
    await persist();
  }
  await workshop.previewDb?.close();
  workshop.previewDb = null;
  workshop.ready = false;
  workshop.preview = null;
  workshop.conversation = [];
  workshop.attachments = [];
  workshop.errors = [];
}
