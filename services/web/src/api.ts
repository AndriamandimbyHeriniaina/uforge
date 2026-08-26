import {
  decryptHapp,
  encryptHapp,
  parseHappEnvelope,
  type HappEnvelope,
  type LocalHapp,
} from './happCrypto';

export type { HappEnvelope, LocalHapp };

const TOKEN_KEY = 'uforge-token';
const HAPP_KEY = 'uforge-has-happ';
const GATEWAY = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000';

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

let sessionPassword: string | null = null;

/**
 * Keeps the account password in RAM for this tab (never written to disk).
 *
 * @example
 * setSessionPassword('correct-horse');
 */
export function setSessionPassword(password: string): void {
  sessionPassword = password;
}

export function clearSessionPassword(): void {
  sessionPassword = null;
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
  const password = sessionPassword;
  if (!password) {
    throw new Error('Reconnecte-toi pour enregistrer l’appli');
  }
  const profile = await me();
  const happ: LocalHapp = {
    email: profile.email,
    name: app.name,
    spec: app.drafts?.[0]?.specJson ?? null,
    appId: app.id,
  };
  await saveEncryptedHapp(happ, password);
  await request<UforgeApp>('/v1/apps/current/compile', {
    method: 'POST',
    body: JSON.stringify({}),
  }).catch(() => app);
  return happ;
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
  return request<GenerateResult>('/v1/ai/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, appId, draftId }),
  });
}
