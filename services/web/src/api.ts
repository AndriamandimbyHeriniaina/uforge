import {
  decryptHapp,
  encryptHapp,
  parseHappEnvelope,
  type HappEnvelope,
  type LocalHapp,
} from './happCrypto';
import { guestPlayerSource } from './runtime/guestPlayerSource';
import { clearAllOverlays } from './runtime/overlay';
import { seedSqlFromSpec } from './runtime/seedSql';
import { clearSqliteOverlays } from './runtime/sqlite';
import type { AppSpec, HappManifest } from './runtime/types';

export type { HappEnvelope, LocalHapp };

const TOKEN_KEY = 'uforge-token';
const HAPP_KEY = 'uforge-has-happ';
const GATEWAY = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000';
const COMPILER = import.meta.env.VITE_COMPILER_URL ?? 'http://localhost:3001';

export type UforgeApp = {
  id: string;
  publicId: string;
  name: string;
  status: string;
  updatedAt: string;
  drafts?: Array<{ id: string; revision: number; specJson: unknown }>;
};

export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type GenerateResult = {
  requestId: string;
  status: string;
  skillsApplied: string[];
  spec?: {
    app?: { name?: string };
    capabilities?: string[];
    pages?: Array<{ name: string; type: string }>;
    conversation?: ChatTurn[];
  };
  reply?: string;
  provider?: string;
  message?: string;
  refusal?: string;
};

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const UNLOCK_KEY = 'uforge-unlocked';

/**
 * Marks this browser tab as allowed to open the builder workshop.
 *
 * @example
 * unlockBuilder();
 */
export function unlockBuilder(): void {
  sessionStorage.setItem(UNLOCK_KEY, '1');
}

/**
 * Closes the builder session so the next U tap is login only.
 *
 * @example
 * lockBuilder();
 */
export function lockBuilder(): void {
  sessionStorage.removeItem(UNLOCK_KEY);
  clearSessionPassword();
}

export function isBuilderUnlocked(): boolean {
  return sessionStorage.getItem(UNLOCK_KEY) === '1';
}

const HAPP_PAYLOAD_KEY = 'uforge-happ-payload';
const PASS_KEY = 'uforge-session-pass';

let sessionPassword: string | null = null;

/**
 * Keeps the account password for this browser tab (sessionStorage, not the .happ).
 *
 * @example
 * setSessionPassword('correct-horse');
 */
export function setSessionPassword(password: string): void {
  sessionPassword = password;
  sessionStorage.setItem(PASS_KEY, password);
}

export function clearSessionPassword(): void {
  sessionPassword = null;
  sessionStorage.removeItem(PASS_KEY);
}

/**
 * Returns the Builder-session password, restored after a refresh of this tab.
 *
 * @example
 * const secret = getSessionPassword();
 */
export function getSessionPassword(): string {
  if (!sessionPassword) {
    sessionPassword = sessionStorage.getItem(PASS_KEY);
  }
  return sessionPassword ?? '';
}

export function hasCompiledHapp(): boolean {
  return Boolean(loadHappEnvelope()) || localStorage.getItem(HAPP_KEY) === '1';
}

/**
 * Remembers that this Runtime already holds a compiled .happ.
 *
 * @example
 * markCompiledHapp();
 */
export function markCompiledHapp(): void {
  localStorage.setItem(HAPP_KEY, '1');
}

/**
 * Public envelope only (email). The JS/spec stay in the ciphertext.
 *
 * @example
 * const envelope = loadHappEnvelope();
 */
export function loadHappEnvelope(): HappEnvelope | null {
  return parseHappEnvelope(localStorage.getItem(HAPP_PAYLOAD_KEY));
}

/**
 * Writes the encrypted .happ on this device. Nothing is uploaded.
 *
 * @example
 * await saveEncryptedHapp(happ, password);
 */
export async function saveEncryptedHapp(
  happ: LocalHapp,
  password: string,
): Promise<HappEnvelope> {
  const envelope = await encryptHapp(happ, password);
  markCompiledHapp();
  localStorage.setItem(HAPP_PAYLOAD_KEY, JSON.stringify(envelope));
  return envelope;
}

/**
 * Decrypts the on-device .happ with the account password.
 *
 * @example
 * const happ = await unlockLocalHapp('secret');
 */
export async function unlockLocalHapp(password: string): Promise<LocalHapp> {
  const envelope = loadHappEnvelope();
  if (!envelope) {
    throw new Error('Aucune appli sur cet appareil');
  }
  return decryptHapp(envelope, password);
}

/**
 * Assembles and encrypts the .happ on the device. The artefact is not sent.
 *
 * @example
 * const happ = await compileOnDevice(app);
 */
export async function compileOnDevice(app: UforgeApp): Promise<LocalHapp> {
  const password = getSessionPassword();
  if (!password) {
    throw new Error('Entre ton mot de passe pour chiffrer l’appli');
  }
  const profile = await me();
  const spec = (app.drafts?.[0]?.specJson ?? null) as AppSpec | null;
  const packed = await packWithCompiler(app, spec);
  const happ: LocalHapp = {
    email: profile.email,
    name: packed.manifest.name || app.name,
    spec,
    appId: app.id,
    bundleJs: packed.bundleJs,
    seedSql: packed.seedSql,
    manifest: packed.manifest,
  };
  await saveEncryptedHapp(happ, password);
  await request<UforgeApp>('/v1/apps/current/compile', {
    method: 'POST',
    body: JSON.stringify({}),
  }).catch(() => app);
  return happ;
}

type PackedGuest = {
  bundleJs?: string;
  seedSql: string;
  manifest: HappManifest;
};

/**
 * Asks the compiler for a minified guest bundle. Falls back to local seed SQL
 * if the compiler is unreachable; the .happ still stays on this device.
 *
 * @example
 * const packed = await packWithCompiler(app, spec);
 */
async function packWithCompiler(
  app: UforgeApp,
  spec: AppSpec | null,
): Promise<PackedGuest> {
  const fallback: PackedGuest = {
    seedSql: seedSqlFromSpec(spec),
    manifest: {
      id: app.id,
      version: '1.0.0',
      name: app.name,
      runtime: { min_version: spec?.app?.runtime?.min_version ?? '1.0.0' },
      capabilities: spec?.capabilities ?? ['storage', 'database'],
    },
  };
  try {
    const response = await fetch(`${COMPILER}/v1/compile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        spec,
        playerSource: guestPlayerSource(),
        appId: app.id,
        appName: app.name,
      }),
    });
    if (!response.ok) {
      return fallback;
    }
    const body = (await response.json()) as {
      status?: string;
      bundleJs?: string;
      seedSql?: string;
      manifest?: HappManifest;
    };
    if (body.status !== 'ok' || !body.bundleJs) {
      return fallback;
    }
    return {
      bundleJs: body.bundleJs,
      seedSql: body.seedSql || fallback.seedSql,
      manifest: { ...fallback.manifest, ...body.manifest },
    };
  } catch {
    return fallback;
  }
}

/**
 * Removes the installed .happ and overlays. The Uforge account is kept.
 *
 * @example
 * await wipeInstalledApp();
 */
export async function wipeInstalledApp(): Promise<void> {
  localStorage.removeItem(HAPP_KEY);
  localStorage.removeItem(HAPP_PAYLOAD_KEY);
  clearAllOverlays();
  await clearSqliteOverlays();
}

/**
 * Resets the Builder draft on the gateway (empty spec). Account is kept.
 *
 * @example
 * await resetCurrentApp();
 */
export function resetCurrentApp() {
  return request<UforgeApp>('/v1/apps/current/reset', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Drops uncompiled Builder work. The device app stays empty until « Utiliser mon appli ».
 *
 * @example
 * await discardUncompiledWork();
 */
export async function discardUncompiledWork(): Promise<void> {
  if (loadHappEnvelope()) {
    return;
  }
  clearAllOverlays();
  await clearSqliteOverlays();
  await resetCurrentApp();
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }
  const token = getToken();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${GATEWAY}${path}`, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as T & {
    message?: string | string[];
  };
  if (!response.ok) {
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message ?? `Erreur ${response.status}`;
    throw new Error(message);
  }
  return body;
}

/**
 * Authenticates against the Uforge gateway.
 *
 * @example
 * await login('ada@uforge.app', 'correct-horse');
 */
export function login(email: string, password: string) {
  return request<{ token: string }>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string) {
  return request<{ token: string }>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function me() {
  return request<{ id: string; email: string; role: string }>('/v1/me');
}

export function listApps() {
  return request<UforgeApp[]>('/v1/apps');
}

export function createApp(name: string) {
  return request<UforgeApp>('/v1/apps', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function getApp(id: string) {
  return request<UforgeApp>(`/v1/apps/${id}`);
}

/**
 * Loads the single app of this Runtime, creating it if needed.
 *
 * @example
 * const app = await currentApp();
 */
export function currentApp() {
  return request<UforgeApp>('/v1/apps/current');
}

export function generate(prompt: string, appId: string, draftId?: string) {
  return generateStream(prompt, appId, () => undefined, draftId);
}

/**
 * POSTs a prompt and reads SSE: `token` then a final `done` with the spec.
 *
 * @example
 * await generateStream('Un stock', appId, (delta) => { bubble += delta; });
 */
export async function generateStream(
  prompt: string,
  appId: string,
  onToken: (delta: string) => void,
  draftId?: string,
): Promise<GenerateResult> {
  const headers = new Headers({ 'content-type': 'application/json' });
  const token = getToken();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${GATEWAY}/v1/ai/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, appId, draftId }),
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    const body = (await response.json().catch(() => ({}))) as GenerateResult & {
      message?: string | string[];
    };
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message ?? `Erreur ${response.status}`;
    throw new Error(message);
  }
  if (!response.body) {
    throw new Error('Réponse vide');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let donePayload: GenerateResult | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buf += decoder.decode(value, { stream: true });
    const blocks = buf.split('\n\n');
    buf = blocks.pop() ?? '';
    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (!event) {
        continue;
      }
      if (event.event === 'token' && event.data && typeof event.data === 'object') {
        const text = String((event.data as { text?: string }).text ?? '');
        if (text) {
          onToken(text);
        }
      }
      if (event.event === 'error') {
        const text = String((event.data as { message?: string })?.message ?? 'Erreur');
        throw new Error(text);
      }
      if (event.event === 'done') {
        donePayload = event.data as GenerateResult;
      }
    }
  }
  if (!donePayload) {
    throw new Error('La génération s’est interrompue');
  }
  if (donePayload.status === 'FAILED') {
    throw new Error(donePayload.message ?? 'Échec de génération');
  }
  return donePayload;
}

function parseSseBlock(block: string): { event: string; data: unknown } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (!dataLines.length) {
    return null;
  }
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return null;
  }
}
