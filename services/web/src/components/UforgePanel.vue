<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import {
  compileOnDevice,
  currentApp,
  generate,
  getSessionPassword,
  login,
  loadHappEnvelope,
  register,
  resetCurrentApp,
  setSessionPassword,
  setToken,
  unlockBuilder,
  unlockLocalHapp,
  wipeInstalledApp,
  discardUncompiledWork,
  isBuilderUnlocked,
  type LocalHapp,
  type UforgeApp,
} from '../api';
import type { AppSpec } from '../runtime/types';

const props = defineProps<{
  app: UforgeApp | null;
  kind: 'welcome' | 'lock' | 'workshop';
  ownerEmail?: string;
  blocking?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  refresh: [];
  compiled: [happ: LocalHapp];
  unlocked: [happ: LocalHapp];
  wiped: [];
}>();

const mode = ref<'login' | 'register'>('login');
const email = ref('');
const password = ref('');
const prompt = ref('');
const busy = ref(false);
const compiling = ref(false);
const wiping = ref(false);
const confirmWipe = ref(false);
const compilePassword = ref('');
const needCompilePassword = ref(false);
const error = ref('');
const loggedIn = ref(props.kind === 'workshop');
const thread = ref<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
const scroller = ref<HTMLElement | null>(null);

const SUGGESTIONS = [
  'Je veux gérer mon stock',
  'Une vitrine pour mon salon',
  'Un petit jeu avec un score',
];

function loadThread(): void {
  const spec = props.app?.drafts?.[0]?.specJson as AppSpec | undefined;
  thread.value = spec?.conversation ? [...spec.conversation] : [];
}

watch(
  () => props.app,
  () => loadThread(),
  { immediate: true },
);

watch(thread, async () => {
  await nextTick();
  if (scroller.value) {
    scroller.value.scrollTop = scroller.value.scrollHeight;
  }
});

async function submitAuth(): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    const useLogin = props.kind === 'lock' || mode.value === 'login';
    const accountEmail =
      props.kind === 'lock'
        ? (props.ownerEmail || email.value).trim()
        : email.value.trim();
    if (props.kind === 'lock' && loadHappEnvelope()) {
      const happ = await unlockLocalHapp(password.value);
      emit('unlocked', happ);
    }
    const fn = useLogin ? login : register;
    const { token } = await fn(accountEmail, password.value);
    setToken(token);
    setSessionPassword(password.value);
    const resumeBuilder = isBuilderUnlocked();
    if (!loadHappEnvelope() && !resumeBuilder) {
      await discardUncompiledWork();
    }
    unlockBuilder();
    emit('refresh');
    if (props.kind === 'lock' && props.blocking) {
      emit('close');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Réessaie';
  } finally {
    busy.value = false;
  }
}

async function send(text = prompt.value): Promise<void> {
  const value = text.trim();
  if (!value || busy.value) {
    return;
  }
  confirmWipe.value = false;
  prompt.value = '';
  thread.value.push({ role: 'user', text: value });
  busy.value = true;
  error.value = '';
  try {
    const target =
      props.app?.id && props.app.id !== 'local'
        ? props.app
        : await currentApp();
    await generate(value, target.id);
    emit('refresh');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Réessaie dans un instant';
  } finally {
    busy.value = false;
  }
}

async function wipeApp(): Promise<void> {
  if (!confirmWipe.value) {
    confirmWipe.value = true;
    return;
  }
  wiping.value = true;
  error.value = '';
  try {
    await resetCurrentApp();
    wipeInstalledApp();
    thread.value = [];
    confirmWipe.value = false;
    emit('wiped');
    emit('refresh');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Pas possible';
  } finally {
    wiping.value = false;
  }
}

async function useApp(): Promise<void> {
  compiling.value = true;
  error.value = '';
  try {
    if (!getSessionPassword()) {
      const typed = compilePassword.value.trim();
      if (!typed) {
        needCompilePassword.value = true;
        error.value = 'Entre ton mot de passe pour chiffrer l’appli.';
        return;
      }
      setSessionPassword(typed);
    }
    const source = props.app?.id && props.app.id !== 'local'
      ? props.app
      : await currentApp();
    const happ = await compileOnDevice(source);
    compilePassword.value = '';
    needCompilePassword.value = false;
    emit('compiled', happ);
    emit('close');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Pas encore possible';
  } finally {
    compiling.value = false;
  }
}

watch(
  () => props.kind,
  (kind) => {
    if (kind === 'lock') {
      mode.value = 'login';
    }
    loggedIn.value = kind === 'workshop';
  },
  { immediate: true },
);

onMounted(() => {
  loadThread();
});
</script>

<template>
  <div
    class="overlay"
    :class="{ calm: kind !== 'workshop' }"
  >
    <button
      v-if="kind !== 'welcome' && !blocking"
      type="button"
      class="backdrop"
      :class="{ light: kind === 'lock' }"
      aria-label="Fermer"
      @click="emit('close')"
    />
    <div
      class="sheet"
      :class="{ center: kind !== 'workshop' }"
      role="dialog"
      aria-label="Uforge"
    >
      <header class="sheet-top">
        <div>
          <p class="eyebrow">Uforge</p>
          <h2>
            {{
              kind === 'welcome'
                ? 'Bienvenue'
                : kind === 'lock'
                  ? 'C’est déjà une appli'
                  : loggedIn
                    ? 'On continue ?'
                    : 'Ton compte'
            }}
          </h2>
        </div>
        <button
          v-if="kind !== 'welcome' && !blocking"
          type="button"
          class="x"
          aria-label="Fermer"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <p v-if="kind === 'welcome'" class="hello">
        Cette application va devenir la tienne. Crée un compte, décris ce que tu
        veux, puis ajuste au fil de la conversation.
      </p>
      <p v-else-if="kind === 'lock'" class="hello">
        Le contenu de l’appli est chiffré. Entre le mot de passe du compte.
      </p>
      <p v-if="kind === 'lock' && ownerEmail" class="account">{{ ownerEmail }}</p>

      <template v-if="!loggedIn">
        <div v-if="kind !== 'lock'" class="tabs">
          <button type="button" :class="{ on: mode === 'login' }" @click="mode = 'login'">
            Connexion
          </button>
          <button
            type="button"
            :class="{ on: mode === 'register' }"
            @click="mode = 'register'"
          >
            Créer un compte
          </button>
        </div>
        <form class="auth" @submit.prevent="submitAuth">
          <input
            v-if="kind !== 'lock' || !ownerEmail"
            v-model="email"
            type="email"
            placeholder="Email"
            required
          />
          <input
            v-model="password"
            type="password"
            placeholder="Mot de passe"
            minlength="8"
            required
          />
          <p v-if="error" class="error">{{ error }}</p>
          <button class="primary" type="submit" :disabled="busy">
            {{
              busy
                ? '…'
                : kind === 'lock' || mode === 'login'
                  ? 'Entrer'
                  : 'Créer'
            }}
          </button>
        </form>
      </template>

      <template v-else>
        <div ref="scroller" class="thread">
          <p v-if="thread.length === 0" class="intro">
            Dis ce que tu veux, puis ajuste. Pas besoin de tout écrire d’un
            coup. Quand c’est bon, tu l’utilises.
          </p>
          <button
            v-for="item in SUGGESTIONS"
            v-show="thread.length === 0"
            :key="item"
            type="button"
            class="chip"
            @click="send(item)"
          >
            {{ item }}
          </button>
          <div v-for="(msg, i) in thread" :key="i" :class="['bubble', msg.role]">
            {{ msg.text }}
          </div>
          <p v-if="busy" class="muted">…</p>
        </div>
        <p v-if="error" class="error pad">{{ error }}</p>
        <form class="composer" @submit.prevent="send()">
          <textarea
            v-model="prompt"
            rows="2"
            placeholder="Ajoute une photo, change le nom…"
            @keydown.enter.exact.prevent="send()"
          />
          <input
            v-if="needCompilePassword"
            v-model="compilePassword"
            type="password"
            placeholder="Mot de passe du compte"
            minlength="8"
            autocomplete="current-password"
            @keydown.enter.exact.prevent="useApp"
          />
          <div class="row">
            <button class="ghost" type="submit" :disabled="busy">Envoyer</button>
            <button
              class="primary"
              type="button"
              :disabled="thread.length === 0 || compiling"
              @click="useApp"
            >
              {{ compiling ? '…' : 'Utiliser mon appli' }}
            </button>
          </div>
          <p v-if="confirmWipe" class="warn">
            L’appli et ses données disparaissent de cet appareil. Ton compte
            reste. Deuxième clic pour confirmer.
          </p>
          <button
            class="danger"
            type="button"
            :disabled="busy || compiling || wiping"
            @click="wipeApp"
          >
            {{
              wiping
                ? '…'
                : confirmWipe
                  ? 'Oui, tout effacer'
                  : 'Tout remettre à zéro'
            }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 1rem;
}
.overlay.calm {
  align-items: center;
  padding: 1.5rem;
}
.backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(12, 11, 10, 0.35);
  cursor: pointer;
}
.backdrop.light {
  background: rgba(12, 11, 10, 0.18);
}
.sheet {
  position: relative;
  width: min(100%, 440px);
  max-height: min(86vh, 720px);
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 22px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sheet.center {
  border-radius: 24px;
}
.hello {
  margin: 0 1.15rem 1rem;
  color: var(--muted);
  line-height: 1.5;
}
.account {
  margin: -0.4rem 1.15rem 1rem;
  color: var(--text);
  font-size: 0.92rem;
}
.sheet-top {
  display: flex;
  justify-content: space-between;
  align-items: start;
  padding: 1.1rem 1.1rem 0.6rem;
}
.eyebrow {
  margin: 0;
  color: var(--copper);
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
}
h2 {
  margin: 0.2rem 0 0;
  font-family: var(--serif);
  font-size: 1.55rem;
  font-weight: 400;
}
.x {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
}
.tabs {
  display: flex;
  gap: 0.35rem;
  margin: 0 1.1rem 0.8rem;
}
.tabs button {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
}
.tabs button.on {
  color: var(--text);
  background: var(--bg-soft);
}
.auth,
.composer {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0 1.1rem 1.1rem;
}
.auth input,
.composer input,
textarea {
  background: var(--bg);
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: 12px;
  padding: 0.7rem 0.8rem;
  font: inherit;
}
.thread {
  flex: 1;
  overflow: auto;
  padding: 0.2rem 1.1rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-height: 220px;
}
.intro {
  margin: 0 0 0.4rem;
  color: var(--muted);
  font-size: 0.95rem;
}
.chip {
  text-align: left;
  background: var(--bg);
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: 12px;
  padding: 0.65rem 0.8rem;
  cursor: pointer;
}
.bubble {
  max-width: 90%;
  padding: 0.65rem 0.8rem;
  border-radius: 14px;
  font-size: 0.95rem;
  line-height: 1.4;
}
.bubble.user {
  margin-left: auto;
  background: var(--bg-soft);
  border-radius: 14px 14px 4px 14px;
}
.bubble.assistant {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 14px 14px 14px 4px;
}
.row {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
.ghost,
.primary {
  border-radius: 12px;
  padding: 0.65rem 0.9rem;
  font-weight: 600;
  cursor: pointer;
}
.ghost {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--text);
}
.primary {
  border: 0;
  background: var(--copper);
  color: #1a120c;
}
.primary:disabled,
.ghost:disabled {
  opacity: 0.45;
}
.danger {
  border: 0;
  background: transparent;
  color: var(--danger);
  font-size: 0.88rem;
  padding: 0.35rem 0;
  cursor: pointer;
  align-self: flex-start;
}
.warn {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.4;
}
.error {
  color: var(--danger);
  margin: 0;
  font-size: 0.88rem;
}
.pad {
  padding: 0 1.1rem;
}
.muted {
  color: var(--muted);
  margin: 0;
}
</style>
