<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { RuntimeErrorItem } from '../core/types';
import { createBridge } from '../runtime/bridge';
import type { AppDatabaseApi } from '../runtime/database';
import { RuntimeCallError } from '../runtime/errors';
import { locate, prepareDocument, stackLine } from '../runtime/guest';

/**
 * The sandboxed app (doc/features/runtime.md § Affichage de l’appli).
 * Opaque origin, no allow-same-origin: the app only reaches the host through
 * runtime.* messages, checked here (source + channel + capability).
 */
const props = defineProps<{
  html: string;
  mode: 'preview' | 'live';
  app: { id: string; name: string; version: number };
  capabilities: string[];
  db: AppDatabaseApi;
  /** Bump to force a reload with the same document. */
  reloadKey?: number;
}>();

const emit = defineEmits<{ error: [RuntimeErrorItem] }>();

const frame = ref<HTMLIFrameElement | null>(null);
const srcdoc = ref('');
let channel = '';
let documentText = '';
let bridge = createBridge({ db: props.db, capabilities: props.capabilities });

function render(): void {
  channel = crypto.randomUUID();
  bridge = createBridge({ db: props.db, capabilities: props.capabilities });
  documentText = prepareDocument(
    props.html,
    {
      channel,
      app: { ...props.app, mode: props.mode },
      ls: props.db.localStorageSnapshot(),
    },
    props.capabilities,
  );
  srcdoc.value = documentText;
}

watch(
  () => [props.html, props.db, props.capabilities.join(','), props.mode, props.reloadKey],
  render,
  { immediate: true },
);

function reply(target: Window, id: number, ok: boolean, payload: unknown): void {
  const message = ok
    ? { __uforge: channel, kind: 'result', id, ok: true, value: payload }
    : { __uforge: channel, kind: 'result', id, ok: false, error: payload };
  try {
    target.postMessage(message, '*');
  } catch {
    target.postMessage(
      { __uforge: channel, kind: 'result', id, ok: false, error: { code: 'invalid', message: 'résultat non transférable' } },
      '*',
    );
  }
}

function onMessage(event: MessageEvent): void {
  const target = frame.value?.contentWindow;
  if (!target || event.source !== target) {
    return;
  }
  const data = event.data as {
    __uforge?: string;
    kind?: string;
    id?: number;
    method?: string;
    params?: unknown;
    error?: { kind?: string; message?: string; stack?: string; line?: number };
  };
  if (!data || data.__uforge !== channel) {
    return;
  }
  if (data.kind === 'call' && typeof data.id === 'number' && typeof data.method === 'string') {
    const id = data.id;
    bridge
      .call(data.method, data.params)
      .then((value) => reply(target, id, true, value ?? null))
      .catch((err: unknown) => {
        const code = err instanceof RuntimeCallError ? err.code : 'invalid';
        const message = err instanceof Error ? err.message : String(err);
        reply(target, id, false, { code, message });
      });
    return;
  }
  if (data.kind === 'error' && data.error && props.mode === 'preview') {
    const line = data.error.line ?? stackLine(data.error.stack);
    const where = line ? locate(documentText, line) : {};
    const detail = where.code ? `\nligne en cause : ${where.code}` : '';
    emit('error', {
      source: 'runtime',
      message: String(data.error.message ?? 'Erreur'),
      stack: `${data.error.stack ?? ''}${detail}`.trim() || undefined,
      file: where.file,
      line: where.line,
    });
  }
}

/**
 * Gives the keyboard to the app. Without it, keys go to the host page and a
 * keyboard game looks frozen after a reload.
 *
 * @example
 * guestFrame.value?.focus();
 */
function focusApp(): void {
  frame.value?.focus();
  frame.value?.contentWindow?.focus();
}

function onLoad(): void {
  if (props.mode === 'live') {
    focusApp();
  }
}

defineExpose({ focus: focusApp });

onMounted(() => window.addEventListener('message', onMessage));
onUnmounted(() => window.removeEventListener('message', onMessage));
</script>

<template>
  <iframe
    ref="frame"
    class="guest"
    :title="app.name"
    :srcdoc="srcdoc"
    sandbox="allow-scripts allow-forms allow-modals"
    referrerpolicy="no-referrer"
    @load="onLoad"
  />
</template>

<style scoped>
.guest {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}
</style>
