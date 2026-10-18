<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { boot, flushLive, offerImport } from '../core/shell';
import { notify, shell } from '../core/state';
import { fromBase64 } from '../lib/bytes';
import { isNative, pickFiles } from '../runtime/native';
import AboutSheet from './AboutSheet.vue';
import FloatButton from './FloatButton.vue';
import GuestFrame from './GuestFrame.vue';
import ImportSheet from './ImportSheet.vue';
import Sheet from './Sheet.vue';
import UnlockForm from './UnlockForm.vue';
import WelcomeScreen from './WelcomeScreen.vue';
import Workshop from './Workshop.vue';

type Panel = 'menu' | 'unlock' | 'about' | null;

const panel = ref<Panel>(null);
const liveFrame = ref<InstanceType<typeof GuestFrame> | null>(null);
// Closing the bubble menu gives the keyboard back to the app.
watch(panel, async (value) => {
  if (value === null && shell.mode === 'app') {
    await nextTick();
    liveFrame.value?.focus();
  }
});
// A sheet opened in one mode must not reappear in the next one (e.g. after an import).
watch(
  () => [shell.mode, shell.header?.appId],
  () => {
    panel.value = null;
  },
);
const canOpenWorkshop = computed(() => Boolean(shell.header?.crypto.admin) && !shell.header?.options.frozen);
const liveApp = computed(() => ({
  id: shell.header?.appId ?? 'app',
  name: shell.build?.manifest.name ?? shell.header?.name ?? 'Appli',
  version: shell.build?.version ?? 0,
}));

async function importFromPicker(): Promise<void> {
  panel.value = null;
  const [file] = await pickFiles('.happ,application/zip,application/octet-stream');
  if (!file) {
    return;
  }
  try {
    offerImport(new Uint8Array(await file.arrayBuffer()));
  } catch (err) {
    notify(err instanceof Error ? err.message : 'Fichier illisible');
  }
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') {
    void flushLive();
  }
}

const cleanups: Array<() => void> = [];

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibility);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));
  if (isNative()) {
    const { App } = await import('@capacitor/app');
    const state = await App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        void flushLive();
      }
    });
    const opened = await App.addListener('appUrlOpen', async ({ url }) => {
      if (!/\.happ($|\?)/i.test(url) && !url.startsWith('content://')) {
        return;
      }
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        const file = await Filesystem.readFile({ path: url });
        offerImport(typeof file.data === 'string' ? fromBase64(file.data) : new Uint8Array(await file.data.arrayBuffer()));
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Fichier illisible');
      }
    });
    cleanups.push(() => void state.remove(), () => void opened.remove());
  }
  try {
    await boot();
  } catch (err) {
    console.error(err);
    shell.mode = 'blank';
    notify('Le stockage de l’appareil est illisible.');
  }
});

onUnmounted(() => cleanups.forEach((cleanup) => cleanup()));
</script>

<template>
  <div class="shell">
    <div v-if="shell.mode === 'loading'" class="splash" aria-label="Chargement"><span>U</span></div>

    <WelcomeScreen v-else-if="shell.mode === 'blank'" />

    <main v-else-if="shell.mode === 'locked' && shell.header" class="locked">
      <div class="locked-panel">
        <p class="eyebrow">Atelier</p>
        <h1 class="serif">On reprend ?</h1>
        <p class="muted">Ton appli n’a pas encore été validée. Ouvre l’atelier pour continuer.</p>
        <UnlockForm :header="shell.header">
          <template #secondary>
            <button type="button" class="btn" @click="importFromPicker">Importer une appli</button>
          </template>
        </UnlockForm>
      </div>
    </main>

    <Workshop v-else-if="shell.mode === 'workshop'" />

    <template v-else-if="shell.mode === 'app' && shell.build && shell.liveDb">
      <GuestFrame
        ref="liveFrame"
        class="live"
        :html="shell.build.html"
        mode="live"
        :app="liveApp"
        :capabilities="shell.build.manifest.capabilities"
        :db="shell.liveDb"
      />
      <FloatButton :hidden="panel !== null" label="Uforge" @open="panel = 'menu'" />

      <Sheet v-if="panel === 'menu'" eyebrow="Uforge" :title="shell.header?.name" @close="panel = null">
        <div class="menu">
          <button v-if="canOpenWorkshop" type="button" class="btn block primary" @click="panel = 'unlock'">
            Ouvrir l’atelier
          </button>
          <button type="button" class="btn block" @click="importFromPicker">Importer une autre appli</button>
          <button type="button" class="btn block" @click="panel = 'about'">À propos</button>
        </div>
      </Sheet>
      <Sheet v-if="panel === 'unlock' && shell.header && canOpenWorkshop" eyebrow="Atelier" title="Mot de passe admin" @close="panel = null">
        <UnlockForm :header="shell.header" @cancel="panel = null" />
      </Sheet>
      <AboutSheet v-if="panel === 'about' && shell.header" :header="shell.header" @close="panel = null" />
    </template>

    <ImportSheet v-if="shell.importOffer" @close="panel = null" />
    <p v-if="shell.toast" class="toast" role="status">{{ shell.toast }}</p>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
}
.splash {
  height: 100dvh;
  display: grid;
  place-items: center;
}
.splash span {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  background: var(--copper);
  color: #1a120c;
  font-family: var(--serif);
  font-size: 2rem;
  animation: breathe 1.6s ease-in-out infinite;
}
.locked {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px 20px;
  background: radial-gradient(120% 70% at 50% -10%, rgba(212, 137, 74, 0.16), transparent 60%), var(--bg);
}
.locked-panel {
  width: 100%;
  max-width: 420px;
  display: grid;
  gap: 0.9rem;
}
.locked-panel h1 {
  margin: 0;
  font-size: 2.4rem;
  line-height: 1.05;
}
.locked-panel p {
  margin: 0;
}
.live {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh;
}
.menu {
  display: grid;
  gap: 0.6rem;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: max(1.4rem, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 100;
  margin: 0;
  max-width: calc(100vw - 2rem);
  padding: 0.7rem 1.1rem;
  border-radius: 999px;
  background: #f3eee6;
  color: #1c1814;
  font-size: 0.92rem;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}
@keyframes breathe {
  50% {
    transform: scale(0.94);
    opacity: 0.8;
  }
}
</style>
