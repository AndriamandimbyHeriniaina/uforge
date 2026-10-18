<script setup lang="ts">
import { computed, ref } from 'vue';
import { confirmImport } from '../core/shell';
import { shell } from '../core/state';
import { formatBytes } from '../lib/bytes';
import Sheet from './Sheet.vue';

const emit = defineEmits<{ close: [] }>();

const step = ref<'review' | 'confirm'>('review');
const busy = ref(false);
const error = ref('');

const offer = computed(() => shell.importOffer);
const incoming = computed(() => offer.value?.header);
const current = computed(() => shell.header);
const size = computed(() =>
  Object.values(offer.value?.files ?? {}).reduce((sum, bytes) => sum + bytes.length, 0),
);

function cancel(): void {
  shell.importOffer = null;
  emit('close');
}

async function proceed(): Promise<void> {
  if (current.value && step.value === 'review') {
    step.value = 'confirm';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    await confirmImport();
    emit('close');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Installation impossible.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Sheet v-if="incoming" eyebrow="Installer une appli" :title="incoming.name" @close="cancel">
    <div class="who">
      <img v-if="incoming.icon" :src="incoming.icon" alt="" class="icon" />
      <div>
        <p v-if="incoming.description" class="muted">{{ incoming.description }}</p>
        <p class="muted small">
          Par {{ incoming.owner }} · version {{ incoming.version }} · {{ formatBytes(size) }}
        </p>
      </div>
    </div>
    <ul class="facts">
      <li>{{ incoming.options.withData ? 'Contient des données.' : 'Sans données : l’appli démarre vide.' }}</li>
      <li v-if="incoming.options.frozen">Appli figée : elle ne pourra pas être modifiée.</li>
      <li v-else>L’atelier reste fermé sans le mot de passe de son auteur.</li>
      <li v-if="incoming.capabilities.includes('camera')">Utilise l’appareil photo.</li>
      <li v-if="incoming.capabilities.includes('network')">Utilise internet.</li>
    </ul>
    <p v-if="current" class="danger-box">
      Elle remplacera <strong>{{ current.name }}</strong>. Son code, son atelier et ses données seront effacés de cet
      appareil.
    </p>
    <p v-if="error" class="error-text">{{ error }}</p>
    <template #footer>
      <button type="button" class="btn" @click="cancel">Annuler</button>
      <button
        type="button"
        class="btn"
        :class="current ? 'danger solid' : 'primary'"
        :disabled="busy"
        @click="proceed"
      >
        {{
          busy
            ? 'Installation…'
            : !current
              ? 'Installer'
              : step === 'review'
                ? 'Remplacer'
                : 'Oui, tout remplacer'
        }}
      </button>
    </template>
  </Sheet>
</template>

<style scoped>
.who {
  display: flex;
  gap: 0.9rem;
  align-items: center;
}
.who p {
  margin: 0;
}
.icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
}
.small {
  font-size: 0.85rem;
}
.facts {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.3rem;
}
p {
  margin: 0;
}
</style>
