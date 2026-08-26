<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import FloatButton from '../components/FloatButton.vue';
import GeneratedApp from '../components/GeneratedApp.vue';
import UforgePanel from '../components/UforgePanel.vue';
import type { AppSpec, HappManifest } from '../runtime/types';
import {
  clearToken,
  currentApp,
  getToken,
  hasCompiledHapp,
  isBuilderUnlocked,
  loadHappEnvelope,
  lockBuilder,
  type LocalHapp,
  type UforgeApp,
} from '../api';

const app = ref<UforgeApp | null>(null);
const panelOpen = ref(false);
const hasAccount = ref(Boolean(getToken()) && isBuilderUnlocked());
const envelope = ref(loadHappEnvelope());
const decryptedHapp = ref<LocalHapp | null>(null);
const toast = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const hasHapp = computed(() => Boolean(envelope.value) || hasCompiledHapp());
const ownerEmail = computed(() => envelope.value?.email ?? '');

const spec = computed<AppSpec | null>(() => {
  const raw = hasAccount.value
    ? app.value?.drafts?.[0]?.specJson
    : decryptedHapp.value?.spec;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return raw as AppSpec;
});

const guestBundleJs = computed(() =>
  hasAccount.value ? undefined : decryptedHapp.value?.bundleJs,
);
const guestSeedSql = computed(() =>
  hasAccount.value ? undefined : decryptedHapp.value?.seedSql,
);
const guestManifest = computed<HappManifest | null>(() => {
  if (hasAccount.value) {
    return null;
  }
  return decryptedHapp.value?.manifest ?? null;
});

const previewName = computed(() => {
  if (hasAccount.value) {
    return app.value?.name ?? 'Mon application';
  }
  return decryptedHapp.value?.name ?? 'Mon application';
});

/** welcome = first run; lock = happ exists, password only; workshop = logged in */
const panelKind = computed<'welcome' | 'lock' | 'workshop'>(() => {
  if (hasAccount.value) {
    return 'workshop';
  }
  return hasHapp.value ? 'lock' : 'welcome';
});

function previewFromHapp(happ: LocalHapp): UforgeApp {
  return {
    id: happ.appId ?? 'local',
    publicId: 'local',
    name: happ.name,
    status: 'PUBLISHED',
    updatedAt: '',
    drafts: [{ id: 'local', revision: 1, specJson: happ.spec }],
  };
}

async function load(): Promise<void> {
  hasAccount.value = Boolean(getToken()) && isBuilderUnlocked();
  envelope.value = loadHappEnvelope();
  if (!hasAccount.value) {
    app.value = decryptedHapp.value
      ? previewFromHapp(decryptedHapp.value)
      : null;
    return;
  }
  try {
    app.value = await currentApp();
  } catch {
    app.value = decryptedHapp.value
      ? previewFromHapp(decryptedHapp.value)
      : null;
  }
}

function openPanel(): void {
  panelOpen.value = true;
}

function showToast(message: string): void {
  toast.value = message;
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    toast.value = '';
  }, 2800);
}

/**
 * After compile the encrypted .happ stays on device; RAM still holds the plaintext.
 *
 * @example
 * onCompiled(happ);
 */
function onCompiled(happ: LocalHapp): void {
  envelope.value = loadHappEnvelope();
  decryptedHapp.value = happ;
  app.value = previewFromHapp(happ);
  lockBuilder();
  clearToken();
  hasAccount.value = false;
  showToast('C’est ton appli. Le U demande le mot de passe.');
}

function onUnlocked(happ: LocalHapp): void {
  decryptedHapp.value = happ;
  app.value = previewFromHapp(happ);
}

function onWiped(): void {
  decryptedHapp.value = null;
  envelope.value = loadHappEnvelope();
  app.value = null;
  showToast('Tout est remis à zéro.');
}

onMounted(() => {
  void load();
  const sealed = Boolean(loadHappEnvelope()) && !decryptedHapp.value;
  if (sealed || (!getToken() && !hasCompiledHapp())) {
    panelOpen.value = true;
  }
});
</script>

<template>
  <div class="shell" :class="{ split: panelOpen && panelKind === 'workshop' }">
    <div class="preview">
      <GeneratedApp
        :spec="spec"
        :app-name="previewName"
        :app-id="app?.id"
        :compact="panelOpen && panelKind === 'workshop'"
        :bundle-js="guestBundleJs"
        :seed-sql="guestSeedSql"
        :manifest="guestManifest"
      />
    </div>
    <FloatButton
      :hidden="panelOpen"
      :label="hasHapp && !hasAccount ? 'Connexion Uforge' : 'Compte Uforge'"
      @open="openPanel"
    />
    <UforgePanel
      v-if="panelOpen"
      :app="app"
      :kind="panelKind"
      :owner-email="ownerEmail"
      :blocking="hasHapp && !decryptedHapp && !hasAccount"
      @close="panelOpen = false"
      @refresh="load"
      @compiled="onCompiled"
      @unlocked="onUnlocked"
      @wiped="onWiped"
    />
    <p v-if="toast" class="toast">{{ toast }}</p>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  min-height: 100dvh;
  touch-action: auto;
}
.preview {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  min-height: 100dvh;
  touch-action: auto;
  pointer-events: auto;
}
.shell.split {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
.shell.split .preview {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  display: flex;
  flex-direction: column;
  z-index: 1;
}
.shell.split .preview :deep(.stage) {
  flex: 1;
  min-height: 0;
  height: auto;
  position: relative;
}
.shell.split .toast {
  top: 0.8rem;
  bottom: auto;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 1.4rem;
  transform: translateX(-50%);
  z-index: 70;
  margin: 0;
  background: #1c1814;
  color: #f3eee6;
  padding: 0.7rem 1.1rem;
  border-radius: 999px;
  font-size: 0.92rem;
}
</style>
