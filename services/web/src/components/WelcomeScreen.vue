<script setup lang="ts">
import { computed, ref } from 'vue';
import { offerImport, startWithAccount } from '../core/shell';
import { notify } from '../core/state';
import { pickFiles } from '../runtime/native';

type Step = 'choose' | 'register' | 'login';

const step = ref<Step>('choose');
const email = ref('');
const password = ref('');
const confirm = ref('');
const busy = ref(false);
const error = ref('');
const dragging = ref(false);

const strength = computed(() => {
  const value = password.value;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^\w]/.test(value)) score += 1;
  return Math.min(4, score);
});
const strengthLabel = computed(() => ['Trop court', 'Faible', 'Correct', 'Bon', 'Solide'][strength.value]);

function go(next: Step): void {
  step.value = next;
  error.value = '';
  password.value = '';
  confirm.value = '';
}

async function submit(): Promise<void> {
  error.value = '';
  if (password.value.length < 8) {
    error.value = 'Le mot de passe doit faire au moins 8 caractères.';
    return;
  }
  if (step.value === 'register' && password.value !== confirm.value) {
    error.value = 'Les deux mots de passe ne correspondent pas.';
    return;
  }
  busy.value = true;
  try {
    await startWithAccount(email.value, password.value, step.value === 'register' ? 'register' : 'login');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Réessaie dans un instant.';
  } finally {
    busy.value = false;
    password.value = '';
    confirm.value = '';
  }
}

async function importFromPicker(): Promise<void> {
  const [file] = await pickFiles('.happ,application/zip,application/octet-stream');
  if (file) {
    await importFile(file);
  }
}

async function importFile(file: File): Promise<void> {
  try {
    offerImport(new Uint8Array(await file.arrayBuffer()));
  } catch (err) {
    notify(err instanceof Error ? err.message : 'Fichier illisible');
  }
}

function onDrop(event: DragEvent): void {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    void importFile(file);
  }
}
</script>

<template>
  <main
    class="welcome"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <div class="panel">
      <div class="brand">
        <span class="mark">U</span>
        <span class="word">Uforge</span>
      </div>

      <template v-if="step === 'choose'">
        <h1 class="serif">Ton appli commence ici.</h1>
        <p class="lead muted">
          Décris ce que tu veux : un jeu, une gestion de stock, une vitrine… L’IA la construit, tu l’ajustes en
          discutant, puis elle devient ton appli.
        </p>
        <div class="actions">
          <button type="button" class="btn primary block" @click="go('register')">Créer mon compte</button>
          <button type="button" class="btn block" @click="go('login')">J’ai déjà un compte</button>
          <button type="button" class="btn block ghost-import" @click="importFromPicker">
            Installer une appli reçue (.happ)
          </button>
        </div>
        <p class="hint muted">Tu peux aussi glisser un fichier .happ sur cet écran.</p>
      </template>

      <form v-else class="form" @submit.prevent="submit">
        <p class="eyebrow">{{ step === 'register' ? 'Compte admin' : 'Connexion' }}</p>
        <h1 class="serif">{{ step === 'register' ? 'Crée ton compte admin' : 'Content de te revoir' }}</h1>
        <p v-if="step === 'register'" class="muted">
          Ce mot de passe ouvre ton atelier et chiffre ton appli. Garde-le bien :
          <strong>s’il est perdu, personne ne peut récupérer l’atelier.</strong>
        </p>
        <p v-else class="muted">Une nouvelle appli vide sera créée sur cet appareil.</p>

        <label class="field">
          <span>Email</span>
          <input v-model="email" class="input" type="email" autocomplete="email" required />
        </label>
        <label class="field">
          <span>Mot de passe</span>
          <input
            v-model="password"
            class="input"
            type="password"
            minlength="8"
            :autocomplete="step === 'register' ? 'new-password' : 'current-password'"
            required
          />
        </label>
        <div v-if="step === 'register' && password" class="meter" :data-level="strength">
          <span v-for="i in 4" :key="i" :class="{ on: i <= strength }" />
          <small>{{ strengthLabel }}</small>
        </div>
        <label v-if="step === 'register'" class="field">
          <span>Confirme le mot de passe</span>
          <input v-model="confirm" class="input" type="password" autocomplete="new-password" required />
        </label>

        <p v-if="error" class="error-text">{{ error }}</p>
        <div class="row">
          <button type="button" class="btn" @click="go('choose')">Retour</button>
          <button type="submit" class="btn primary" :disabled="busy">
            {{ busy ? 'Un instant…' : step === 'register' ? 'Créer et commencer' : 'Se connecter' }}
          </button>
        </div>
      </form>
    </div>
  </main>
</template>

<style scoped>
.welcome {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom));
  background:
    radial-gradient(120% 70% at 50% -10%, rgba(212, 137, 74, 0.18), transparent 60%),
    var(--bg);
  transition: background 0.2s ease;
}
.welcome.dragging {
  background: radial-gradient(120% 90% at 50% 40%, rgba(212, 137, 74, 0.32), transparent 70%), var(--bg);
}
.panel {
  width: 100%;
  max-width: 440px;
  display: grid;
  gap: 1.1rem;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.mark {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: var(--copper);
  color: #1a120c;
  font-family: var(--serif);
  font-size: 1.6rem;
}
.word {
  font-family: var(--serif);
  font-size: 1.5rem;
}
h1 {
  margin: 0;
  font-size: clamp(2.2rem, 8vw, 3rem);
  line-height: 1.05;
}
.lead {
  margin: 0;
  font-size: 1.05rem;
}
.actions {
  display: grid;
  gap: 0.6rem;
  margin-top: 0.4rem;
}
.ghost-import {
  border-style: dashed;
  color: var(--muted);
}
.hint {
  margin: 0;
  font-size: 0.85rem;
  text-align: center;
}
.form {
  display: grid;
  gap: 0.9rem;
}
.form p {
  margin: 0;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
}
.meter {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.meter span {
  flex: 1;
  height: 4px;
  border-radius: 4px;
  background: var(--line);
}
.meter span.on {
  background: var(--copper);
}
.meter[data-level='0'] span.on,
.meter[data-level='1'] span.on {
  background: var(--danger);
}
.meter small {
  min-width: 5.5rem;
  text-align: right;
  color: var(--muted);
}
</style>
