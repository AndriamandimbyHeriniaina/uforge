<script setup lang="ts">
import type { HappHeader } from '../core/types';
import Sheet from './Sheet.vue';

defineProps<{ header: HappHeader }>();
const emit = defineEmits<{ close: [] }>();

const CAPABILITY_LABELS: Record<string, string> = {
  camera: 'Appareil photo',
  network: 'Internet',
  geolocation: 'Position',
  notifications: 'Notifications',
  haptics: 'Vibrations',
};
</script>

<template>
  <Sheet eyebrow="À propos" :title="header.name" @close="emit('close')">
    <div class="who">
      <img v-if="header.icon" :src="header.icon" alt="" class="icon" />
      <p v-if="header.description" class="muted">{{ header.description }}</p>
    </div>
    <dl>
      <div>
        <dt>Créée par</dt>
        <dd>{{ header.owner }}</dd>
      </div>
      <div>
        <dt>Version</dt>
        <dd>{{ header.version || 'pas encore validée' }}</dd>
      </div>
      <div>
        <dt>Utilise</dt>
        <dd>
          {{
            header.capabilities.length
              ? header.capabilities.map((cap) => CAPABILITY_LABELS[cap] ?? cap).join(', ')
              : 'Rien de particulier (fonctionne hors ligne)'
          }}
        </dd>
      </div>
      <div v-if="header.options.frozen">
        <dt>Atelier</dt>
        <dd>Appli figée : elle ne peut pas être modifiée.</dd>
      </div>
    </dl>
    <p class="muted small">Propulsé par Uforge.</p>
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
dl {
  margin: 0;
  display: grid;
  gap: 0.6rem;
}
dl div {
  display: grid;
  gap: 0.1rem;
}
dt {
  font-size: 0.8rem;
  color: var(--muted);
}
dd {
  margin: 0;
}
.small {
  margin: 0;
  font-size: 0.82rem;
}
</style>
