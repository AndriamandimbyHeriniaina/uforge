<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppMark from '../components/AppMark.vue';
import { generate, getApp, type GenerateResult, type UforgeApp } from '../api';

type ThreadItem =
  | { kind: 'user'; text: string }
  | { kind: 'spec'; result: GenerateResult };

const SUGGESTIONS = [
  'Gestion de stock avec photo produit, hors ligne',
  'Vitrine de salon de coiffure avec prises de rendez-vous',
  'Petit jeu HTML5, scores enregistrés en local',
];

const route = useRoute();
const router = useRouter();
const app = ref<UforgeApp | null>(null);
const prompt = ref('');
const busy = ref(false);
const error = ref('');
const thread = ref<ThreadItem[]>([]);

const appId = computed(() => String(route.params.id));

const lastSpec = computed(() => {
  for (let i = thread.value.length - 1; i >= 0; i -= 1) {
    const item = thread.value[i];
    if (item.kind === 'spec') {
      return item.result;
    }
  }
  return null;
});

async function load(): Promise<void> {
  error.value = '';
  try {
    app.value = await getApp(appId.value);
    const draft = app.value.drafts?.[0];
    const spec = draft?.specJson as GenerateResult['spec'] | undefined;
    if (spec && Object.keys(spec).length > 0) {
      thread.value = [
        {
          kind: 'spec',
          result: {
            requestId: '',
            status: 'SUCCEEDED',
            skillsApplied: [],
            spec,
          },
        },
      ];
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'App introuvable';
  }
}

async function send(text = prompt.value): Promise<void> {
  const value = text.trim();
  if (!value || busy.value) {
    return;
  }
  error.value = '';
  prompt.value = '';
  thread.value.push({ kind: 'user', text: value });
  busy.value = true;
  try {
    const result = await generate(value, appId.value);
    thread.value.push({ kind: 'spec', result });
    app.value = await getApp(appId.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Génération impossible';
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="builder">
    <header class="top">
      <button type="button" class="back" @click="router.push('/')">Atelier</button>
      <div class="title">
        <AppMark />
        <div>
          <strong>{{ app?.name ?? '…' }}</strong>
          <span>{{ app?.publicId }}</span>
        </div>
      </div>
      <span class="hint">Builder</span>
    </header>

    <div class="layout">
      <aside class="side">
        <p class="eyebrow">Aperçu</p>
        <h2>{{ lastSpec?.spec?.app?.name ?? app?.name ?? 'En attente' }}</h2>
        <p class="muted">
          L’IA écrit une spec. Le Runtime l’exécutera. Ce n’est pas encore le
          rendu final.
        </p>
        <div v-if="lastSpec?.spec?.capabilities?.length" class="caps">
          <span v-for="cap in lastSpec.spec.capabilities" :key="cap">{{ cap }}</span>
        </div>
        <div v-if="lastSpec?.spec?.pages?.length" class="pages">
          <p class="eyebrow">Pages</p>
          <ul>
            <li v-for="page in lastSpec.spec.pages" :key="page.name">
              {{ page.name }}
              <em>{{ page.type }}</em>
            </li>
          </ul>
        </div>
        <p v-if="lastSpec?.skillsApplied?.length" class="skills">
          Skills : {{ lastSpec.skillsApplied.join(', ') }}
        </p>
      </aside>

      <section class="stage">
        <div class="thread">
          <div v-if="thread.length === 0" class="welcome">
            <p class="eyebrow">Décris</p>
            <h2>Que dois-tu forger ?</h2>
            <p class="muted">
              CRUD, vitrine ou jeu HTML5 — Uforge reste dans le Runtime.
            </p>
            <div class="chips">
              <button
                v-for="item in SUGGESTIONS"
                :key="item"
                type="button"
                @click="send(item)"
              >
                {{ item }}
              </button>
            </div>
          </div>

          <article v-for="(item, index) in thread" :key="index" :class="item.kind">
            <p v-if="item.kind === 'user'">{{ item.text }}</p>
            <div v-else>
              <p class="status">{{ item.result.status }}</p>
              <p v-if="item.result.spec?.notes" class="muted">
                {{ item.result.spec.notes }}
              </p>
            </div>
          </article>
          <p v-if="busy" class="muted">Forge en cours…</p>
          <p v-if="error" class="error">{{ error }}</p>
        </div>

        <form class="composer" @submit.prevent="send()">
          <textarea
            v-model="prompt"
            rows="3"
            placeholder="Ex. Je veux une caisse pour mon food-truck, photos des plats, ça marche sans internet."
            @keydown.enter.exact.prevent="send()"
          />
          <button class="primary" type="submit" :disabled="busy">Envoyer</button>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.builder {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.top {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0.9rem 1.4rem;
  border-bottom: 1px solid var(--line);
}
.back,
.hint {
  color: var(--muted);
  font-size: 0.88rem;
}
.back {
  background: none;
  border: 0;
  text-align: left;
  cursor: pointer;
  width: fit-content;
}
.title {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.title span {
  display: block;
  color: var(--muted);
  font-size: 0.78rem;
}
.hint {
  text-align: right;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.7rem;
}
.layout {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 0;
}
.side {
  border-right: 1px solid var(--line);
  padding: 1.6rem 1.3rem;
}
.eyebrow {
  margin: 0;
  color: var(--copper);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.7rem;
  font-weight: 600;
}
.side h2,
.welcome h2 {
  margin: 0.35rem 0 0.6rem;
  font-family: var(--serif);
  font-weight: 400;
  font-size: 1.7rem;
}
.muted {
  color: var(--muted);
}
.caps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 1rem 0;
}
.caps span {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.75rem;
  color: var(--copper);
}
.pages ul {
  list-style: none;
  margin: 0.4rem 0 0;
  padding: 0;
}
.pages li {
  display: flex;
  justify-content: space-between;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--line);
  font-size: 0.9rem;
}
.pages em {
  color: var(--muted);
  font-style: normal;
  font-size: 0.78rem;
}
.skills {
  margin-top: 1.2rem;
  font-size: 0.78rem;
  color: var(--muted);
}
.stage {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 64px);
}
.thread {
  flex: 1;
  overflow: auto;
  padding: 2rem 2.2rem 1rem;
}
.welcome {
  max-width: 36rem;
  padding-top: 3rem;
}
.chips {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.2rem;
}
.chips button {
  text-align: left;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: 12px;
  padding: 0.8rem 1rem;
  cursor: pointer;
}
.chips button:hover {
  border-color: rgba(212, 137, 74, 0.5);
}
.user,
.spec {
  max-width: 40rem;
  margin-bottom: 1rem;
}
.user {
  background: var(--bg-soft);
  border-radius: 16px 16px 4px 16px;
  padding: 0.85rem 1rem;
  margin-left: auto;
}
.user p {
  margin: 0;
}
.spec {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 1rem;
}
.status {
  margin: 0 0 0.4rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: var(--ok);
}
.composer {
  display: flex;
  gap: 0.7rem;
  padding: 1rem 2.2rem 1.4rem;
  border-top: 1px solid var(--line);
  background: var(--bg-elevated);
}
textarea {
  flex: 1;
  resize: none;
  background: var(--bg);
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: 14px;
  padding: 0.85rem 1rem;
  outline: none;
}
textarea:focus {
  border-color: var(--copper);
}
.primary {
  align-self: end;
  border: 0;
  background: var(--copper);
  color: #1a120c;
  font-weight: 600;
  border-radius: 12px;
  padding: 0.8rem 1.1rem;
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.55;
}
.error {
  color: var(--danger);
}
@media (max-width: 840px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .side {
    display: none;
  }
  .composer {
    padding: 0.8rem 1rem 1.2rem;
  }
}
</style>
