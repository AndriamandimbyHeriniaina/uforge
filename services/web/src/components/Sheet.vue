<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  title?: string;
  eyebrow?: string;
  /** No close button, no backdrop dismiss. */
  persistent?: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

// A tap that opened this sheet can produce a late click on the backdrop: ignore it.
const openedAt = performance.now();

function onBackdrop(): void {
  if (!props.persistent && performance.now() - openedAt > 400) {
    emit('close');
  }
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !props.persistent) {
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="layer" @click.self="onBackdrop">
    <section class="sheet" role="dialog" aria-modal="true" :aria-label="title">
      <header v-if="title || eyebrow || !persistent" class="head">
        <div>
          <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
          <h2 v-if="title">{{ title }}</h2>
        </div>
        <button v-if="!persistent" type="button" class="close" aria-label="Fermer" @click="emit('close')">×</button>
      </header>
      <div class="body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="foot">
        <slot name="footer" />
      </footer>
    </section>
  </div>
</template>

<style scoped>
.layer {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(6, 5, 4, 0.62);
  backdrop-filter: blur(4px);
  animation: fade 0.16s ease-out;
}
.sheet {
  width: 100%;
  max-width: 520px;
  max-height: min(92dvh, 760px);
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 22px 22px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  animation: rise 0.2s ease-out;
}
@media (min-width: 640px) {
  .layer {
    align-items: center;
  }
  .sheet {
    border-radius: 22px;
  }
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.3rem 0.4rem;
}
h2 {
  margin: 0.15rem 0 0;
  font-family: var(--serif);
  font-weight: 400;
  font-size: 1.7rem;
  line-height: 1.15;
}
.close {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}
.body {
  padding: 0.6rem 1.3rem 1.2rem;
  overflow-y: auto;
  display: grid;
  gap: 0.9rem;
}
.foot {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  flex-wrap: wrap;
  padding: 0.9rem 1.3rem 1.2rem;
  border-top: 1px solid var(--line);
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
@keyframes rise {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
}
</style>
