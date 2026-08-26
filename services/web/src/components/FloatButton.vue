<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{
  hidden?: boolean;
  label?: string;
}>();

const emit = defineEmits<{
  open: [];
}>();

const STORAGE = 'uforge-fab';
const SIZE = 56;
const THRESHOLD = 18;
const pos = ref({ x: 24, y: 24 });
const dragging = ref(false);

let origin = { x: 0, y: 0, px: 0, py: 0 };
let pointerId = -1;
let dragged = false;
let skipClick = false;

function clampPosition(next: { x: number; y: number }): { x: number; y: number } {
  const maxX = Math.max(8, window.innerWidth - SIZE - 8);
  const maxY = Math.max(8, window.innerHeight - SIZE - 8);
  return {
    x: Math.min(maxX, Math.max(8, next.x)),
    y: Math.min(maxY, Math.max(8, next.y)),
  };
}

function persist(): void {
  localStorage.setItem(STORAGE, JSON.stringify(pos.value));
}

/**
 * Opens the Uforge panel unless this pointer sequence was a drag.
 *
 * @example
 * emitOpen();
 */
function emitOpen(): void {
  skipClick = true;
  emit('open');
  window.setTimeout(() => {
    skipClick = false;
  }, 80);
}

function onPointerMove(event: PointerEvent): void {
  if (event.pointerId !== pointerId) {
    return;
  }
  const dx = event.clientX - origin.x;
  const dy = event.clientY - origin.y;
  if (!dragged && dx * dx + dy * dy < THRESHOLD * THRESHOLD) {
    return;
  }
  dragged = true;
  dragging.value = true;
  pos.value = clampPosition({ x: origin.px + dx, y: origin.py + dy });
}

function onPointerUp(event: PointerEvent): void {
  if (event.pointerId !== pointerId) {
    return;
  }
  const wasDrag = dragged;
  pointerId = -1;
  dragging.value = false;
  persist();
  const target = event.currentTarget as HTMLElement | null;
  if (target?.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }
  if (!wasDrag && event.type !== 'pointercancel') {
    emitOpen();
  }
}

function onPointerDown(event: PointerEvent): void {
  if (props.hidden) {
    return;
  }
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }
  dragged = false;
  pointerId = event.pointerId;
  origin = { x: event.clientX, y: event.clientY, px: pos.value.x, py: pos.value.y };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onClick(event: MouseEvent): void {
  if (skipClick) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  emit('open');
}

function onResize(): void {
  pos.value = clampPosition(pos.value);
}

onMounted(() => {
  const saved = localStorage.getItem(STORAGE);
  if (saved) {
    try {
      pos.value = clampPosition(JSON.parse(saved) as { x: number; y: number });
    } catch {
      pos.value = clampPosition({
        x: window.innerWidth - 72,
        y: window.innerHeight - 96,
      });
    }
  } else {
    pos.value = clampPosition({
      x: window.innerWidth - 72,
      y: window.innerHeight - 96,
    });
  }
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <button
    type="button"
    class="fab"
    :class="{ dragging, hidden }"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    :tabindex="hidden ? -1 : 0"
    :aria-hidden="hidden ? 'true' : undefined"
    :aria-label="label ?? 'Compte Uforge'"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click="onClick"
  >
    U
  </button>
</template>

<style scoped>
.fab {
  position: fixed;
  z-index: 80;
  width: 56px;
  height: 56px;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(255, 244, 230, 0.55);
  border-radius: 50%;
  background: rgba(212, 137, 74, 0.5);
  color: rgba(255, 248, 240, 0.98);
  font-family: var(--serif);
  font-size: 1.45rem;
  backdrop-filter: blur(10px);
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.fab.dragging {
  cursor: grabbing;
  background: rgba(212, 137, 74, 0.7);
}
.fab.hidden {
  opacity: 0;
  pointer-events: none;
}
</style>
