<script setup lang="ts">
import { computed, ref } from 'vue';
import { exportApp } from '../core/shell';
import { notify } from '../core/state';
import { builder, workshop } from '../core/workshop';
import { saveFile } from '../runtime/native';
import Sheet from './Sheet.vue';

const emit = defineEmits<{ close: [] }>();

const withData = ref(false);
const frozen = ref(false);
const busy = ref(false);
const error = ref('');

const neverBuilt = computed(() => workshop.builtVersion === 0);
const draftAhead = computed(() => workshop.builtVersion > 0 && workshop.currentVersion !== workshop.builtVersion);

async function run(buildFirst: boolean): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    if (buildFirst) {
      const problems = await builder();
      if (problems) {
        error.value = `Le build a échoué : ${problems[0]}`;
        return;
      }
    }
    const { bytes, fileName } = await exportApp({ withData: withData.value, frozen: frozen.value });
    await saveFile(fileName, 'application/vnd.uforge.happ', new Blob([bytes as BlobPart], { type: 'application/vnd.uforge.happ' }));
    notify(`${fileName} est prêt.`);
    emit('close');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Export impossible.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Sheet eyebrow="Partager" title="Exporter l’appli" @close="emit('close')">
    <p class="muted">
      Tu obtiens un fichier <strong>.happ</strong> à envoyer. La personne qui l’importe utilise l’appli sans mot de
      passe.
    </p>

    <label class="option">
      <input v-model="withData" type="checkbox" />
      <span>
        <strong>Inclure mes données</strong>
        <small class="muted">Sinon, l’appli démarre vide chez l’autre personne.</small>
      </span>
    </label>
    <label class="option">
      <input v-model="frozen" type="checkbox" />
      <span>
        <strong>Appli figée</strong>
        <small class="muted">Personne ne pourra ouvrir l’atelier de ce fichier, même avec ton mot de passe.</small>
      </span>
    </label>

    <p class="warn-box">
      Toute personne qui a ce fichier peut utiliser l’appli.
      <template v-if="!frozen">
        Avec ton mot de passe, elle pourrait aussi la modifier avec ton compte.
      </template>
    </p>
    <p v-if="neverBuilt" class="danger-box">L’appli n’a jamais été validée : « Builder » d’abord.</p>
    <p v-else-if="draftAhead" class="muted">
      Ton brouillon (v{{ workshop.currentVersion }}) est plus récent que la version validée (v{{ workshop.builtVersion }}).
    </p>
    <p v-if="error" class="error-text">{{ error }}</p>

    <template #footer>
      <button v-if="draftAhead" type="button" class="btn" :disabled="busy" @click="run(false)">
        Exporter v{{ workshop.builtVersion }}
      </button>
      <button
        type="button"
        class="btn primary"
        :disabled="busy"
        @click="run(neverBuilt || draftAhead)"
      >
        {{ busy ? 'Préparation…' : neverBuilt || draftAhead ? 'Builder puis exporter' : 'Exporter' }}
      </button>
    </template>
  </Sheet>
</template>

<style scoped>
p {
  margin: 0;
}
.option {
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
  padding: 0.8rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  cursor: pointer;
}
.option input {
  width: 20px;
  height: 20px;
  margin-top: 0.15rem;
  accent-color: var(--copper);
}
.option span {
  display: grid;
  gap: 0.15rem;
}
.option small {
  font-size: 0.86rem;
}
</style>
