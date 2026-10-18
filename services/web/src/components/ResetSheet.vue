<script setup lang="ts">
import { computed, ref } from 'vue';
import { wipeEverything } from '../core/shell';
import { notify, shell } from '../core/state';
import { clearData } from '../core/workshop';
import Sheet from './Sheet.vue';

const emit = defineEmits<{ close: [] }>();

const confirmData = ref(false);
const typed = ref('');
const busy = ref(false);
const appName = computed(() => shell.header?.name ?? '');

async function emptyData(): Promise<void> {
  if (!confirmData.value) {
    confirmData.value = true;
    return;
  }
  busy.value = true;
  try {
    await clearData();
    notify('Les données sont vidées.');
    emit('close');
  } finally {
    busy.value = false;
  }
}

async function wipe(): Promise<void> {
  busy.value = true;
  try {
    await wipeEverything();
    emit('close');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Sheet eyebrow="Réinitialiser" title="Repartir de zéro" @close="emit('close')">
    <section class="block">
      <h3>Vider les données</h3>
      <p class="muted">
        Efface ce que l’appli a enregistré (base live et base d’aperçu). Le code, les versions et la conversation
        restent.
      </p>
      <button type="button" class="btn danger" :disabled="busy" @click="emptyData">
        {{ confirmData ? 'Confirmer : vider les données' : 'Vider les données' }}
      </button>
    </section>

    <section class="block">
      <h3>Tout effacer</h3>
      <p class="muted">
        Supprime l’appli, son atelier et ses données de cet appareil. Ton compte Uforge reste. Pour confirmer, tape
        « <strong>{{ appName }}</strong> ».
      </p>
      <input v-model="typed" class="input" :placeholder="appName" aria-label="Nom de l’appli" />
      <button type="button" class="btn danger solid" :disabled="busy || typed.trim() !== appName" @click="wipe">
        Tout effacer
      </button>
    </section>
  </Sheet>
</template>

<style scoped>
.block {
  display: grid;
  gap: 0.6rem;
  padding: 0.9rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
}
h3 {
  margin: 0;
  font-size: 1rem;
}
p {
  margin: 0;
}
</style>
