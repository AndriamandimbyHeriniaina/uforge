import { markRaw } from 'vue';
import { AppDatabase } from '../runtime/database';
import { hasBlock, readAppBlock, readHeader, readLiveDb, wipeInstall, writeLiveDb } from './device';
import { buildHappFile, installHapp, parseHappFile, type ExportOptions } from './happFile';
import { closeSession, createInstall, saveAdmin, setExpireHandler, unlock } from './session';
import { notify, shell } from './state';
import { disposeWorkshop, openWorkshop } from './workshop';

/**
 * Mode machine of the Runtime (doc/features/runtime.md § Modes).
 */

/**
 * Reads what is installed and picks the mode.
 *
 * @example
 * await boot();
 */
export async function boot(): Promise<void> {
  setExpireHandler(() => void leaveWorkshop('Atelier fermé après 15 minutes d’inactivité.'));
  shell.header = await readHeader();
  await settle();
}

async function settle(): Promise<void> {
  const header = shell.header;
  if (!header) {
    shell.mode = 'blank';
    return;
  }
  if (await hasBlock('app')) {
    await startLive();
    return;
  }
  shell.mode = header.crypto.admin ? 'locked' : 'blank';
}

async function startLive(): Promise<void> {
  const header = shell.header;
  if (!header) {
    shell.mode = 'blank';
    return;
  }
  const build = await readAppBlock(header.appId);
  if (!build) {
    shell.mode = header.crypto.admin ? 'locked' : 'blank';
    return;
  }
  await shell.liveDb?.close();
  const bytes = await readLiveDb(header.appId);
  shell.liveDb = markRaw(await AppDatabase.open(bytes, (data) => writeLiveDb(header.appId, data)));
  shell.build = markRaw(build);
  shell.mode = 'app';
}

async function stopLive(): Promise<void> {
  await shell.liveDb?.close();
  shell.liveDb = null;
  shell.build = null;
}

/**
 * First launch: account + empty app, straight into the workshop.
 *
 * @example
 * await startWithAccount('ada@example.com', 'correct-horse', 'register');
 */
export async function startWithAccount(email: string, password: string, kind: 'register' | 'login'): Promise<void> {
  shell.header = await createInstall(email, password, kind);
  await enterWorkshop();
}

/**
 * Opens the workshop with the admin password (bubble or lock screen).
 *
 * @example
 * await openWithPassword(password);
 */
export async function openWithPassword(password: string): Promise<void> {
  const header = shell.header ?? (await readHeader());
  if (!header) {
    throw new Error('Aucune appli installée');
  }
  shell.header = header;
  await unlock(header, password);
  await enterWorkshop();
}

async function enterWorkshop(): Promise<void> {
  await stopLive();
  shell.mode = 'workshop';
  await openWorkshop();
}

/**
 * Closes the workshop: saves, forgets the secrets, shows the live app.
 *
 * @example
 * await leaveWorkshop('C’est ton appli.');
 */
export async function leaveWorkshop(message?: string): Promise<void> {
  if (shell.mode !== 'workshop') {
    return;
  }
  await disposeWorkshop();
  await saveAdmin();
  closeSession();
  shell.header = await readHeader();
  await settle();
  if (message) {
    notify(message);
  }
}

/**
 * Exports the installed app as a .happ (admin only).
 *
 * @example
 * const file = await exportApp({ withData: false, frozen: true });
 */
export async function exportApp(options: ExportOptions): Promise<{ bytes: Uint8Array; fileName: string }> {
  if (!shell.header) {
    throw new Error('Aucune appli à exporter');
  }
  await saveAdmin();
  return buildHappFile(shell.header, options);
}

/**
 * Reads a .happ and asks for confirmation (ImportSheet).
 *
 * @example
 * await offerImport(bytes);
 */
export function offerImport(bytes: Uint8Array): void {
  shell.importOffer = markRaw(parseHappFile(bytes));
}

/**
 * Replaces the installed app with the offered .happ.
 *
 * @example
 * await confirmImport();
 */
export async function confirmImport(): Promise<void> {
  const offer = shell.importOffer;
  if (!offer) {
    return;
  }
  if (shell.mode === 'workshop') {
    await disposeWorkshop();
    await saveAdmin();
    closeSession();
  }
  await stopLive();
  shell.header = await installHapp(offer);
  shell.importOffer = null;
  await settle();
  notify(`« ${shell.header.name} » est installée.`);
}

/**
 * « Tout effacer » : the Runtime becomes blank. The Uforge account stays.
 *
 * @example
 * await wipeEverything();
 */
export async function wipeEverything(): Promise<void> {
  await disposeWorkshop();
  closeSession();
  await stopLive();
  await wipeInstall();
  shell.header = null;
  shell.mode = 'blank';
  notify('Tout est effacé.');
}

/** Persists live writes before the app goes to the background. */
export async function flushLive(): Promise<void> {
  await shell.liveDb?.flush();
}
