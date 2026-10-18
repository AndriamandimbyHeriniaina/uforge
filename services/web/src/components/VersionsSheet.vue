<script setup lang="ts">
import { ref } from 'vue';
import { restore, workshop } from '../core/workshop';
import Sheet from './Sheet.vue';

const emit = defineEmits<{ close: [] }>();
const busy = ref(0);

function when(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

async function back(n: number): Promise<void> {
  busy.value = n;
  try {
    await restore(n);
    emit('close');
  } finally {
    busy.value = 0;
  }
}
</script>

<template>
  <Sheet eyebrow="Historique" title="Versions" @close="emit('close')">
    <p class="muted intro">Revenir à une version en crée une nouvelle : rien n’est jamais perdu.</p>
    <ol class="list">
      <li v-for="version in workshop.versions" :key="version.n" :class="{ current: version.n === workshop.currentVersion }">
        <div class="text">
          <strong>
            v{{ version.n }}
            <span v-if="version.n === workshop.currentVersion" class="tag">brouillon</span>
            <span v-if="version.n === workshop.builtVersion" class="tag live">en service</span>
          </strong>
          <span class="message">{{ version.message }}</span>
          <small class="muted">{{ when(version.at) }}</small>
        </div>
        <button
          v-if="version.n !== workshop.currentVersion"
          type="button"
          class="btn small"
          :disabled="busy !== 0 || workshop.busy"
          @click="back(version.n)"
        >
          {{ busy === version.n ? '…' : 'Revenir' }}
        </button>
      </li>
    </ol>
  </Sheet>
</template>

<style scoped>
.intro {
  margin: 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.list li {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.75rem 0.85rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
}
.list li.current {
  border-color: rgba(212, 137, 74, 0.5);
  background: var(--copper-dim);
}
.text {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.1rem;
}
.message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag {
  margin-left: 0.4rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 500;
  background: var(--bg-hover);
  color: var(--muted);
}
.tag.live {
  background: rgba(183, 201, 163, 0.16);
  color: var(--ok);
}
</style>
