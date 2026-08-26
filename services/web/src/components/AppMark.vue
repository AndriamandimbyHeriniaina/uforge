<script setup lang="ts">
defineProps<{ word?: string }>();
</script>

<template>
  <span class="mark" aria-hidden="true">
    <span class="mark__anvil" />
    <span class="mark__word">{{ word ?? 'U' }}</span>
  </span>
</template>

<style scoped>
.mark {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9px;
  background: var(--copper-dim);
  border: 1px solid rgba(212, 137, 74, 0.35);
  position: relative;
}
.mark__word {
  font-family: var(--serif);
  font-size: 1.15rem;
  color: var(--copper);
  line-height: 1;
}
.mark__anvil {
  display: none;
}
</style>
