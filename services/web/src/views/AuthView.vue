<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppMark from '../components/AppMark.vue';
import { login, register, setToken } from '../api';

const router = useRouter();
const mode = ref<'login' | 'register'>('login');
const email = ref('');
const password = ref('');
const busy = ref(false);
const error = ref('');

async function submit(): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    const fn = mode.value === 'login' ? login : register;
    const { token } = await fn(email.value.trim(), password.value);
    setToken(token);
    await router.push('/');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Une erreur est survenue';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="auth">
    <section class="panel panel--brand">
      <div class="brand-row">
        <AppMark />
        <div>
          <p class="eyebrow">You Forge</p>
          <h1>Uforge</h1>
        </div>
      </div>
      <p class="lede">
        Crée un compte, dis ce que tu veux. Ensuite, Uforge
        <em>devient</em> ton appli.
      </p>
      <ul class="points">
        <li>Pas besoin de savoir coder</li>
        <li>Ça marche sans internet au quotidien</li>
        <li>Tu pourras encore la modifier, plus tard</li>
      </ul>
    </section>

    <section class="panel panel--form">
      <div class="tabs" role="tablist">
        <button
          type="button"
          :class="{ active: mode === 'login' }"
          @click="mode = 'login'"
        >
          Connexion
        </button>
        <button
          type="button"
          :class="{ active: mode === 'register' }"
          @click="mode = 'register'"
        >
          Créer un compte
        </button>
      </div>

      <form @submit.prevent="submit">
        <label>
          Email
          <input v-model="email" type="email" autocomplete="email" required />
        </label>
        <label>
          Mot de passe
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            minlength="8"
            required
          />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="primary" type="submit" :disabled="busy">
          {{ busy ? 'Un instant…' : mode === 'login' ? 'Entrer' : 'Commencer' }}
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
}
.panel {
  padding: 4rem 4.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.5rem;
}
.panel--brand {
  background:
    radial-gradient(900px 420px at 10% 0%, rgba(212, 137, 74, 0.14), transparent 55%),
    var(--bg);
  border-right: 1px solid var(--line);
}
.brand-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.eyebrow {
  margin: 0;
  color: var(--copper);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 600;
}
h1 {
  margin: 0.1rem 0 0;
  font-family: var(--serif);
  font-size: 3.4rem;
  font-weight: 400;
  letter-spacing: -0.03em;
}
.lede {
  margin: 0;
  max-width: 28rem;
  color: var(--muted);
  font-size: 1.12rem;
}
.lede em {
  font-style: italic;
  color: var(--text);
}
.points {
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--text);
}
.points li {
  padding: 0.7rem 0;
  border-top: 1px solid var(--line);
  color: var(--muted);
}
.panel--form {
  background: var(--bg-elevated);
}
.tabs {
  display: flex;
  gap: 0.4rem;
  padding: 0.25rem;
  background: var(--bg);
  border-radius: 999px;
  width: fit-content;
  border: 1px solid var(--line);
}
.tabs button {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 0.45rem 1rem;
  border-radius: 999px;
  cursor: pointer;
}
.tabs button.active {
  background: var(--bg-soft);
  color: var(--text);
}
form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 22rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.86rem;
  color: var(--muted);
}
input {
  background: var(--bg);
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  outline: none;
}
input:focus {
  border-color: var(--copper);
}
.primary {
  margin-top: 0.4rem;
  border: 0;
  background: var(--copper);
  color: #1a120c;
  font-weight: 600;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.6;
}
.error {
  margin: 0;
  color: var(--danger);
  font-size: 0.9rem;
}
@media (max-width: 860px) {
  .auth {
    grid-template-columns: 1fr;
  }
  .panel--brand {
    border-right: 0;
    border-bottom: 1px solid var(--line);
    padding: 2.5rem 1.5rem 2rem;
  }
  .panel {
    padding: 2rem 1.5rem;
  }
  h1 {
    font-size: 2.4rem;
  }
}
</style>
