import { reactive } from 'vue';
import type { AppDatabase } from '../runtime/database';
import type { ParsedHapp } from './happFile';
import type { AppBlock, HappHeader } from './types';

export type Mode = 'loading' | 'blank' | 'locked' | 'workshop' | 'app';

/**
 * Shell state (doc/features/runtime.md § Modes). Heavy objects (build, db,
 * parsed file) are stored with markRaw by the actions that set them.
 */
export const shell = reactive({
  mode: 'loading' as Mode,
  header: null as HappHeader | null,
  build: null as AppBlock | null,
  liveDb: null as AppDatabase | null,
  importOffer: null as ParsedHapp | null,
  toast: '',
});

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Short message at the bottom of the screen.
 *
 * @example
 * notify('C’est ton appli.');
 */
export function notify(message: string, ms = 3200): void {
  shell.toast = message;
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    shell.toast = '';
  }, ms);
}
