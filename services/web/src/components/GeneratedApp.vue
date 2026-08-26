<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { buildGuestDocument } from '../runtime/buildGuestDocument';
import { handleRuntimeCall } from '../runtime/hostBridge';
import type { AppSpec, RuntimeRequest } from '../runtime/types';

const props = defineProps<{
  spec: AppSpec | null;
  appName: string;
  appId?: string;
  /** True when the Builder sheet shares the screen (no overlap with the guest). */
  compact?: boolean;
}>();

const frame = ref<HTMLIFrameElement | null>(null);
const cameraInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

let imageWaiter: ((value: string | null) => void) | null = null;
let fileWaiter: ((value: { name: string; dataUrl: string } | null) => void) | null = null;

const appId = computed(() => props.appId || 'preview');

const srcdoc = computed(() => buildGuestDocument(props.spec));
const frameKey = computed(() => JSON.stringify(props.spec ?? null));

function pickImage(): Promise<string | null> {
  return new Promise((resolve) => {
    imageWaiter = resolve;
    cameraInput.value?.click();
    window.addEventListener(
      'focus',
      () => {
        window.setTimeout(() => {
          if (imageWaiter === resolve) {
            imageWaiter = null;
            resolve(null);
          }
        }, 600);
      },
      { once: true },
    );
  });
}

function pickFile(): Promise<{ name: string; dataUrl: string } | null> {
  return new Promise((resolve) => {
    fileWaiter = resolve;
    fileInput.value?.click();
    window.addEventListener(
      'focus',
      () => {
        window.setTimeout(() => {
          if (fileWaiter === resolve) {
            fileWaiter = null;
            resolve(null);
          }
        }, 600);
      },
      { once: true },
    );
  });
}

async function share(text: string): Promise<void> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
  } catch {
    /* user cancelled the share sheet */
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard may be blocked */
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function onCameraChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  const done = imageWaiter;
  imageWaiter = null;
  if (!done) {
    return;
  }
  if (!file) {
    done(null);
    return;
  }
  void readFileAsDataUrl(file).then(done, () => done(null));
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  const done = fileWaiter;
  fileWaiter = null;
  if (!done) {
    return;
  }
  if (!file) {
    done(null);
    return;
  }
  void readFileAsDataUrl(file).then(
    (dataUrl) => done({ name: file.name, dataUrl }),
    () => done(null),
  );
}

async function onMessage(event: MessageEvent): Promise<void> {
  if (event.source !== frame.value?.contentWindow) {
    return;
  }
  const data = event.data as RuntimeRequest | undefined;
  if (!data || data.type !== 'runtime' || !data.id) {
    return;
  }
  const spec = props.spec ?? { capabilities: [] };
  const reply = { type: 'runtime-result', id: data.id } as {
    type: string;
    id: string;
    result?: unknown;
    error?: string;
  };
  try {
    reply.result = await handleRuntimeCall(
      appId.value,
      spec,
      data.method,
      data.params ?? {},
      { pickImage, pickFile, share },
    );
  } catch (err) {
    reply.error = err instanceof Error ? err.message : 'runtime error';
  }
  const guest = frame.value?.contentWindow;
  guest?.postMessage(reply, '*');
}

onMounted(() => {
  window.addEventListener('message', onMessage);
});

onUnmounted(() => {
  window.removeEventListener('message', onMessage);
});

watch(srcdoc, () => {
  imageWaiter?.(null);
  fileWaiter?.(null);
  imageWaiter = null;
  fileWaiter = null;
});
</script>

<template>
  <div class="stage" :class="{ compact }">
    <iframe
      :key="frameKey"
      ref="frame"
      class="guest"
      sandbox="allow-scripts"
      :srcdoc="srcdoc"
      :title="appName"
    />
    <input
      ref="cameraInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden-input"
      @change="onCameraChange"
    />
    <input
      ref="fileInput"
      type="file"
      class="hidden-input"
      @change="onFileChange"
    />
  </div>
</template>

<style scoped>
.stage {
  min-height: 100vh;
  min-height: 100dvh;
  background: #f4efe8;
}
.stage.compact {
  min-height: 0;
  height: 100%;
}
.guest {
  display: block;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  border: 0;
  background: #f4efe8;
  pointer-events: auto;
  touch-action: auto;
}
.stage.compact .guest {
  height: 100%;
}
.hidden-input {
  display: none;
}
</style>
