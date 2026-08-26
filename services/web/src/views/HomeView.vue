<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppMark from '../components/AppMark.vue';
import {
  clearToken,
  createApp,
  listApps,
  me,
  type UforgeApp,
} from '../api';

const router = useRouter();
const apps = ref<UforgeApp[]>([]);
const email = ref('');
const creating = ref(false);
const draftName = ref('');
const error = ref('');
const loaded = ref(false);

async function load(): Promise<void> {
  try {
    const [profile, list] = await Promise.all([me(), listApps()]);
    email.value = profile.email;
    apps.value = list;
  } catch {
    clearToken();
    await router.replace('/auth');
  } finally {
    loaded.value = true;
  }
}

function logout(): void {
  clearToken();
  void router.push('/auth');
}

async function forge(): Promise<void> {
  error.value = '';
  creating.value = true;
  try {
    const name = draftName.value.trim() || 'Nouvelle application';
    const app = await createApp(name);
    await router.push(`/app/${app.id}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de créer';
  } finally {
    creating.value = false;
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    EMPTY: 'Vierge',
    DRAFT: 'Brouillon',
    PREVIEW: 'Aperçu',
    PUBLISHED: 'Publiée',
    ARCHIVED: 'Archivée',
  };
  return map[status] ?? status;
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="shell">
    <header class="top">
      <div class="brand">
        <AppMark />
        <div>
          <strong>Uforge</strong>
          <span>You Forge</span>
        </div>
      </div>
      <div class="top-actions">
        <span class="who">{{ email }}</span>
        <button type="button" class="ghost" @click="logout">Quitter</button>
      </div>
    </header>

    <main class="main">
      <div class="hero">
        <div>
          <p class="eyebrow">Atelier</p>
          <h1>Tes applications</h1>
          <p class="sub">
            Chaque app vit dans le Runtime. Décris-la, prévisualise, compile.
          </p>
        </div>
        <form class="create" @submit.prevent="forge">
          <input
            v-model="draftName"
            placeholder="Nom — stock, salon, jeu…"
            maxlength="80"
          />
          <button class="primary" type="submit" :disabled="creating">
            {{ creating ? 'Création…' : 'Forger' }}
          </button>
        </form>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <section v-if="loaded && apps.length === 0" class="empty">
        <h2>Rien sur l’établi.</h2>
        <p>
          Donne un nom à droite, ou lance directement une idée : gestion,
          vitrine, ou un petit jeu HTML5.
        </p>
      </section>

      <section v-else class="grid">
        <button
          v-for="app in apps"
          :key="app.id"
          type="button"
          class="card"
          @click="router.push(`/app/${app.id}`)"
        >
          <span class="card-status">{{ statusLabel(app.status) }}</span>
          <h3>{{ app.name }}</h3>
          <p>{{ app.publicId }}</p>
        </button>
      </section>
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.1rem 2rem;
  border-bottom: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.brand strong {
  display: block;
  font-size: 1rem;
}
.brand span {
  color: var(--muted);
  font-size: 0.78rem;
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.who {
  color: var(--muted);
  font-size: 0.88rem;
}
.ghost {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
}
.main {
  max-width: 1080px;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
}
.hero {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  align-items: end;
  margin-bottom: 2.5rem;
}
.eyebrow {
  margin: 0;
  color: var(--copper);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 600;
}
h1 {
  margin: 0.2rem 0 0.4rem;
  font-family: var(--serif);
  font-size: 3rem;
  font-weight: 400;
}
.sub {
  margin: 0;
  color: var(--muted);
}
.create {
  display: flex;
  gap: 0.5rem;
  min-width: min(100%, 28rem);
}
.create input {
  flex: 1;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: 12px;
  padding: 0.8rem 0.95rem;
}
.primary {
  border: 0;
  background: var(--copper);
  color: #1a120c;
  font-weight: 600;
  border-radius: 12px;
  padding: 0 1.2rem;
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.6;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
.card {
  text-align: left;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.2rem;
  cursor: pointer;
  min-height: 9rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.card:hover {
  border-color: rgba(212, 137, 74, 0.45);
}
.card-status {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--copper);
}
.card h3 {
  margin: 0.4rem 0 0;
  font-size: 1.25rem;
}
.card p {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}
.empty {
  border: 1px dashed var(--line);
  border-radius: var(--radius);
  padding: 3rem 2rem;
  color: var(--muted);
}
.empty h2 {
  margin: 0 0 0.5rem;
  font-family: var(--serif);
  font-weight: 400;
  color: var(--text);
  font-size: 2rem;
}
.error {
  color: var(--danger);
}
@media (max-width: 720px) {
  .hero {
    flex-direction: column;
    align-items: stretch;
  }
  h1 {
    font-size: 2.3rem;
  }
}
</style>
