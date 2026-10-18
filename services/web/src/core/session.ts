import { reactive } from 'vue';
import { RUNTIME_VERSION, SESSION_IDLE_MS } from '../config';
import { normalizeEmail, randomKey, unwrapAdminKey, wrapAdminKey } from '../lib/crypto';
import { readAdminBlock, replaceInstall, sealAdminBlock, writeAdminBlock } from './device';
import { GatewayError, login, register } from './gateway';
import type { AdminBlock, HappHeader } from './types';
import { newAdminBlock } from './workspace';

/**
 * Admin session, in RAM only: password is never stored; K_admin and the JWT
 * are dropped on close, on Builder and after SESSION_IDLE_MS of inactivity.
 */

type Secrets = {
  token: string;
  kAdmin: CryptoKey | null;
  admin: AdminBlock | null;
  appId: string;
};

const secrets: Secrets = { token: '', kAdmin: null, admin: null, appId: '' };

export const session = reactive({
  active: false,
  email: '',
  /** True when the gateway accepted the password (prompts allowed). */
  online: false,
  warning: '',
});

let lastActivity = Date.now();
let idleTimer: ReturnType<typeof setInterval> | null = null;
let onExpire: (() => void) | null = null;
let saveChain: Promise<void> = Promise.resolve();

/**
 * Called by the app shell to leave the workshop when the session expires.
 *
 * @example
 * setExpireHandler(() => void leaveWorkshop('Session fermée après inactivité.'));
 */
export function setExpireHandler(handler: () => void): void {
  onExpire = handler;
}

/**
 * First launch: creates (or reuses) the Uforge account and a fresh, empty app.
 *
 * @example
 * const header = await createInstall('ada@example.com', 'correct-horse', 'register');
 */
export async function createInstall(
  email: string,
  password: string,
  kind: 'register' | 'login',
): Promise<HappHeader> {
  const owner = normalizeEmail(email);
  const { token } = kind === 'register' ? await register(owner, password) : await login(owner, password);
  const appId = crypto.randomUUID();
  const kAdmin = await randomKey(true);
  const admin = await newAdminBlock();
  const header: HappHeader = {
    format: 1,
    runtimeMin: RUNTIME_VERSION,
    appId,
    name: 'Mon application',
    icon: null,
    owner,
    version: 0,
    options: { frozen: false, withData: true },
    capabilities: [],
    crypto: { admin: await wrapAdminKey(kAdmin, owner, password, appId) },
  };
  await replaceInstall({ header, admin: await sealAdminBlock(appId, kAdmin, admin) });
  start({ token, kAdmin, admin, appId }, owner, true, '');
  return header;
}

/**
 * Opens the workshop of the installed app with the admin password.
 * Local proof first (K_admin), then the gateway session for prompts.
 *
 * @example
 * await unlock(header, password);
 */
export async function unlock(header: HappHeader, password: string): Promise<void> {
  if (!header.crypto.admin || header.options.frozen) {
    throw new Error('Cette appli est figée : son atelier n’est pas disponible.');
  }
  const kAdmin = await unwrapAdminKey(header.crypto.admin, header.owner, password, header.appId);
  const admin = await readAdminBlock(header.appId, kAdmin);
  let token = '';
  let warning = '';
  try {
    token = (await login(header.owner, password)).token;
  } catch (err) {
    warning =
      err instanceof GatewayError && err.status === 401
        ? 'Le service Uforge refuse ce mot de passe (a-t-il changé ?). L’atelier s’ouvre sans IA.'
        : 'Hors ligne : l’atelier s’ouvre sans IA (versions, export, réinitialisation).';
  }
  start({ token, kAdmin, admin, appId: header.appId }, header.owner, Boolean(token), warning);
}

function start(next: Secrets, email: string, online: boolean, warning: string): void {
  Object.assign(secrets, next);
  session.active = true;
  session.email = email;
  session.online = online;
  session.warning = warning;
  touch();
  if (idleTimer) {
    clearInterval(idleTimer);
  }
  idleTimer = setInterval(() => {
    if (session.active && Date.now() - lastActivity > SESSION_IDLE_MS) {
      onExpire?.();
    }
  }, 20_000);
}

/** Marks admin activity (keeps the session open). */
export function touch(): void {
  lastActivity = Date.now();
}

/**
 * @example
 * const admin = adminBlock();
 */
export function adminBlock(): AdminBlock {
  if (!secrets.admin) {
    throw new Error('Atelier fermé');
  }
  return secrets.admin;
}

export function adminKey(): CryptoKey {
  if (!secrets.kAdmin) {
    throw new Error('Atelier fermé');
  }
  return secrets.kAdmin;
}

export function sessionToken(): string {
  return secrets.token;
}

/** The gateway rejected the token: keep the workshop, disable prompts. */
export function markOffline(warning: string): void {
  secrets.token = '';
  session.online = false;
  session.warning = warning;
}

/**
 * Encrypts and stores the admin block. Saves are serialised.
 *
 * @example
 * await saveAdmin();
 */
export function saveAdmin(): Promise<void> {
  const { admin, kAdmin, appId } = secrets;
  if (!admin || !kAdmin) {
    return saveChain;
  }
  saveChain = saveChain.then(() => writeAdminBlock(appId, kAdmin, admin)).catch((err) => {
    console.error('admin block not saved', err);
  });
  return saveChain;
}

/**
 * Forgets every secret. Call after the last saveAdmin().
 *
 * @example
 * await saveAdmin(); closeSession();
 */
export function closeSession(): void {
  secrets.token = '';
  secrets.kAdmin = null;
  secrets.admin = null;
  secrets.appId = '';
  session.active = false;
  session.online = false;
  session.warning = '';
  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }
}
