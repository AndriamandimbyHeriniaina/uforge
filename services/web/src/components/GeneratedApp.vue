<script setup lang="ts">
import { computed, ref } from 'vue';

export type AppSpec = {
  app?: { name?: string };
  pages?: Array<{ name: string; type: string }>;
  capabilities?: string[];
  conversation?: Array<{ role: 'user' | 'assistant'; text: string }>;
};

const props = defineProps<{
  spec: AppSpec | null;
  appName: string;
}>();

const pages = computed(() => {
  if (props.spec?.pages?.length) {
    return props.spec.pages;
  }
  return [{ name: 'Accueil', type: 'home' }];
});

const current = ref(0);
const page = computed(() => pages.value[current.value] ?? pages.value[0]);
</script>

<template>
  <div class="app">
    <main class="body">
      <h1>{{ page.name }}</h1>
      <p v-if="!spec?.pages?.length">
        Ton application est encore vide. Ouvre le bouton Uforge pour la
        décrire, petit à petit.
      </p>
      <p v-else-if="page.type === 'dashboard'">Tes chiffres du jour.</p>
      <p v-else-if="page.type === 'crud'">Tes listes, à ajouter et modifier ici.</p>
      <p v-else>L’écran {{ page.name }} de ton application.</p>
    </main>
    <nav v-if="pages.length > 1" class="tabs">
      <button
        v-for="(item, index) in pages"
        :key="item.name"
        type="button"
        :class="{ on: index === current }"
        @click="current = index"
      >
        {{ item.name }}
      </button>
    </nav>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f4efe8;
  color: #1c1814;
}
.body {
  flex: 1;
  padding: 1.6rem 1.3rem 6rem;
}
.body h1 {
  margin: 0 0 0.7rem;
  font-family: var(--serif);
  font-size: 2rem;
  font-weight: 400;
}
.body p {
  margin: 0;
  color: #5c564e;
  line-height: 1.55;
  max-width: 22rem;
}
.tabs {
  display: flex;
  border-top: 1px solid #e4dcd0;
  background: #fffdf9;
}
.tabs button {
  flex: 1;
  border: 0;
  background: transparent;
  padding: 0.9rem 0.35rem;
  font-size: 0.78rem;
  color: #8a8278;
  cursor: pointer;
}
.tabs button.on {
  color: #1c1814;
  font-weight: 600;
}
</style>
