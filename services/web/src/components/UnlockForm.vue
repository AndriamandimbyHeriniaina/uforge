<script setup lang="ts">
import { ref } from 'vue';
import { openWithPassword } from '../core/shell';
import type { HappHeader } from '../core/types';

defineProps<{ header: HappHeader }>();
const emit = defineEmits<{ cancel: [] }>();

const password = ref('');
const busy = ref(false);
const error = ref('');

async function submit(): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    await openWithPassword(password.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Réessaie.';
  } finally {
    password.value = '';
    busy.value = false;
  }
}
</script>

<template>
  <form class="unlock" @submit.prevent="submit">
    <div class="who">
      <img v-if="header.icon" :src="header.icon" alt="" class="icon" />
      <div>
        <strong>{{ header.name }}</strong>
        <span class="muted">{{ header.owner }}</span>
      </div>
    </div>
    <label class="field">
      <span>Mot de passe du compte admin</span>
      <input
        v-model="password"
        class="input"
        type="password"
        autocomplete="current-password"
        required
        autofocus
      />
    </label>
    <p v-if="error" class="error-text">{{ error }}</p>
    <div class="row">
      <slot name="secondary">
        <button type="button" class="btn" @click="emit('cancel')">Annuler</button>
      </slot>
      <button type="submit" class="btn primary" :disabled="busy || !password">
        {{ busy ? 'Ouverture…' : 'Ouvrir l’atelier' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.unlock {
  display: grid;
  gap: 0.9rem;
}
.who {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem;
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  border: 1px solid var(--line);
}
.who div {
  display: grid;
  min-width: 0;
}
.who span {
  font-size: 0.88rem;
  overflow: hidden;
  text-overflow: ellipsis;
}
.icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: cover;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
}
</style>
