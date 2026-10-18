<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { leaveWorkshop, offerImport } from '../core/shell';
import { notify, shell } from '../core/state';
import { session, touch } from '../core/session';
import type { ChatOp } from '../core/types';
import {
  addAttachments,
  addRuntimeError,
  builder,
  exportSources,
  fixErrors,
  rebuildPreview,
  resetPreviewData,
  sendMessage,
  stopTurn,
  workshop,
} from '../core/workshop';
import { appNameOf } from '../core/workspace';
import { formatBytes } from '../lib/bytes';
import { pickFiles, saveFile } from '../runtime/native';
import ExportSheet from './ExportSheet.vue';
import GuestFrame from './GuestFrame.vue';
import ResetSheet from './ResetSheet.vue';
import VersionsSheet from './VersionsSheet.vue';

type SheetName = 'versions' | 'export' | 'reset' | null;

const draft = ref('');
const menuOpen = ref(false);
const sheet = ref<SheetName>(null);
const fullscreen = ref(false);
const wide = ref(false);
const showErrors = ref(false);
const building = ref(false);
const thread = ref<HTMLElement | null>(null);
const previewFrame = ref<InstanceType<typeof GuestFrame> | null>(null);

// Full-screen test: the keyboard goes to the app, like in live mode.
watch(fullscreen, async (value) => {
  if (value) {
    await nextTick();
    previewFrame.value?.focus();
  }
});

const appName = computed(() => {
  void workshop.rev;
  return appNameOf(workshop.workspace);
});
const draftLabel = computed(() => {
  if (workshop.builtVersion === 0) {
    return 'brouillon';
  }
  return workshop.currentVersion === workshop.builtVersion
    ? 'en service'
    : `brouillon · v${workshop.builtVersion} en service`;
});

/** Chat text without the blank lines left between file operations. */
function tidy(text: string): string {
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const frameApp = computed(() => ({
  id: shell.header?.appId ?? 'preview',
  name: appName.value,
  version: workshop.currentVersion,
}));
const canSend = computed(() => !workshop.busy && (draft.value.trim().length > 0 || workshop.attachments.length > 0));

async function send(): Promise<void> {
  if (!canSend.value) {
    return;
  }
  const text = draft.value.trim() || 'Utilise les pièces jointes.';
  draft.value = '';
  await sendMessage(text);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void send();
  }
}

async function attach(): Promise<void> {
  const files = await pickFiles('image/*,.csv,.txt,.json,.md,.svg,.xlsx,.xls', true);
  const problems = await addAttachments(files);
  if (problems.length) {
    notify(problems.join(' '), 5000);
  }
}

function removeAttachment(id: string): void {
  workshop.attachments = workshop.attachments.filter((attachment) => attachment.id !== id);
}

async function onBuilder(): Promise<void> {
  menuOpen.value = false;
  building.value = true;
  try {
    const problems = await builder();
    if (problems) {
      showErrors.value = true;
      notify('Le build a échoué : corrige les problèmes d’abord.', 4000);
      return;
    }
    await leaveWorkshop('C’est ton appli. La bulle U rouvre l’atelier.');
  } finally {
    building.value = false;
  }
}

async function importFromMenu(): Promise<void> {
  menuOpen.value = false;
  const [file] = await pickFiles('.happ,application/zip,application/octet-stream');
  if (!file) {
    return;
  }
  try {
    offerImport(new Uint8Array(await file.arrayBuffer()));
  } catch (err) {
    notify(err instanceof Error ? err.message : 'Fichier illisible');
  }
}

async function downloadSources(): Promise<void> {
  menuOpen.value = false;
  const { bytes, fileName } = await exportSources();
  await saveFile(fileName, 'application/zip', new Blob([bytes as BlobPart], { type: 'application/zip' }));
  notify(`${fileName} est prêt.`);
}

function open(name: SheetName): void {
  menuOpen.value = false;
  sheet.value = name;
}

function opIcon(op: ChatOp): string {
  return op.op === 'delete' ? '−' : op.op === 'rename' ? '→' : op.op === 'write' ? '+' : '✎';
}

function opLabel(op: ChatOp): string {
  return op.path.split('/').pop() ?? op.path;
}

async function scrollToEnd(): Promise<void> {
  await nextTick();
  thread.value?.scrollTo({ top: thread.value.scrollHeight });
}

watch(
  () => {
    const last = workshop.conversation[workshop.conversation.length - 1];
    return `${workshop.conversation.length}:${last?.text.length ?? 0}:${last?.ops?.length ?? 0}`;
  },
  () => void scrollToEnd(),
);

function activity(): void {
  touch();
}

onMounted(() => {
  void scrollToEnd();
  window.addEventListener('pointerdown', activity);
  window.addEventListener('keydown', activity);
});
onUnmounted(() => {
  window.removeEventListener('pointerdown', activity);
  window.removeEventListener('keydown', activity);
});
</script>

<template>
  <div class="workshop" :class="{ fullscreen }">
    <section class="stage">
      <div class="stage-bar">
        <div class="status">
          <span class="dot" :class="{ live: workshop.currentVersion === workshop.builtVersion && workshop.builtVersion > 0 }" />
          <span>v{{ workshop.currentVersion }} · {{ draftLabel }}</span>
        </div>
        <div class="stage-actions">
          <select
            class="data-select"
            :value="workshop.previewData"
            aria-label="Données de l’aperçu"
            @change="resetPreviewData(($event.target as HTMLSelectElement).value as 'live' | 'empty')"
          >
            <option value="live">Vraies données</option>
            <option value="empty">Base vide</option>
          </select>
          <button type="button" class="icon-btn" title="Recharger l’aperçu" aria-label="Recharger l’aperçu" @click="rebuildPreview">
            ⟳
          </button>
          <button type="button" class="icon-btn desktop-only" :title="wide ? 'Format mobile' : 'Pleine largeur'" @click="wide = !wide">
            {{ wide ? '▯' : '▭' }}
          </button>
          <button type="button" class="icon-btn" title="Plein écran" aria-label="Plein écran" @click="fullscreen = true">⛶</button>
        </div>
      </div>
      <div class="device" :class="{ wide }">
        <GuestFrame
          v-if="workshop.preview && workshop.previewDb"
          ref="previewFrame"
          :html="workshop.preview.html"
          mode="preview"
          :app="frameApp"
          :capabilities="workshop.preview.manifest.capabilities"
          :db="workshop.previewDb"
          :reload-key="workshop.previewKey"
          @error="addRuntimeError"
        />
        <div v-else class="placeholder">
          {{ workshop.building ? 'Construction de l’aperçu…' : 'Aperçu indisponible : regarde les problèmes signalés.' }}
        </div>
        <div v-if="workshop.building" class="building"><span /></div>
      </div>
      <button v-if="fullscreen" type="button" class="exit-full" @click="fullscreen = false">Retour à l’atelier</button>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div class="title">
          <p class="eyebrow">Atelier</p>
          <h1>{{ appName }}</h1>
        </div>
        <div class="head-actions">
          <button type="button" class="btn primary small" :disabled="building || workshop.busy" @click="onBuilder">
            {{ building ? 'Build…' : 'Builder' }}
          </button>
          <div class="menu-wrap">
            <button type="button" class="btn small" aria-label="Menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">⋯</button>
            <div v-if="menuOpen" class="menu" role="menu">
              <button type="button" role="menuitem" @click="open('versions')">Versions</button>
              <button type="button" role="menuitem" @click="open('export')">Exporter (.happ)</button>
              <button type="button" role="menuitem" @click="downloadSources">Télécharger le code (.zip)</button>
              <button type="button" role="menuitem" @click="importFromMenu">Importer une appli</button>
              <button type="button" role="menuitem" @click="open('reset')">Réinitialiser…</button>
              <button type="button" role="menuitem" @click="leaveWorkshop()">Fermer l’atelier</button>
            </div>
          </div>
        </div>
      </header>

      <p v-if="session.warning" class="warn-box notice">{{ session.warning }}</p>

      <div ref="thread" class="thread" @click="menuOpen = false">
        <div v-if="workshop.conversation.length === 0" class="intro">
          <p class="serif big">Qu’est-ce qu’on construit ?</p>
          <p class="muted">
            Décris ton idée comme à une personne : « un jeu de serpent avec des niveaux », « la gestion du stock de ma
            boutique avec photos », « une vitrine pour mon restaurant »… Tu ajustes ensuite, message après message.
          </p>
        </div>
        <template v-for="(turn, index) in workshop.conversation" :key="index">
          <div v-if="turn.role === 'user'" class="bubble user">
            <p>{{ turn.text }}</p>
            <small v-if="turn.attachments?.length" class="muted">📎 {{ turn.attachments.join(', ') }}</small>
          </div>
          <div v-else class="bubble assistant" :class="turn.status">
            <p v-if="tidy(turn.text)">{{ tidy(turn.text) }}</p>
            <p v-else-if="turn.status === 'streaming'" class="muted thinking">Uforge réfléchit…</p>
            <ul v-if="turn.ops?.length" class="chips">
              <li v-for="(op, opIndex) in turn.ops" :key="opIndex" :class="{ done: op.done }" :title="op.path">
                <span>{{ opIcon(op) }}</span>{{ opLabel(op) }}
              </li>
            </ul>
            <p v-if="turn.error" class="error-text">{{ turn.error }}</p>
            <small v-if="turn.version" class="muted">Version {{ turn.version }}</small>
          </div>
        </template>
      </div>

      <div v-if="workshop.errors.length" class="errors">
        <div class="errors-head">
          <strong>
            {{ workshop.errors.length }} problème{{ workshop.errors.length > 1 ? 's' : '' }} dans l’appli
          </strong>
          <button type="button" class="btn small" @click="showErrors = !showErrors">{{ showErrors ? 'Masquer' : 'Voir' }}</button>
          <button type="button" class="btn small primary" :disabled="workshop.busy || !session.online" @click="fixErrors">
            Corriger
          </button>
        </div>
        <ul v-if="showErrors">
          <li v-for="(error, index) in workshop.errors" :key="index">
            <code v-if="error.file">{{ error.file }}{{ error.line ? `:${error.line}` : '' }}</code>
            {{ error.message }}
          </li>
        </ul>
      </div>

      <form class="composer" @submit.prevent="send">
        <ul v-if="workshop.attachments.length" class="attachments">
          <li v-for="attachment in workshop.attachments" :key="attachment.id">
            <img v-if="attachment.previewUrl" :src="attachment.previewUrl" alt="" />
            <div class="meta">
              <span class="name">{{ attachment.name }}</span>
              <label v-if="attachment.kind === 'image'" class="use">
                <input v-model="attachment.useInApp" type="checkbox" />
                utiliser dans l’appli
              </label>
              <small v-else class="muted">{{ formatBytes(attachment.size) }}</small>
            </div>
            <button type="button" class="remove" aria-label="Retirer" @click="removeAttachment(attachment.id)">×</button>
          </li>
        </ul>
        <div class="input-row">
          <button type="button" class="icon-btn attach" aria-label="Joindre un fichier" title="Joindre" @click="attach">＋</button>
          <textarea
            v-model="draft"
            rows="2"
            :placeholder="workshop.conversation.length ? 'Ajuste : « mets le bouton en bas », « ajoute une page contact »…' : 'Décris ton appli…'"
            @keydown="onKeydown"
          />
          <button v-if="workshop.busy" type="button" class="btn small" @click="stopTurn">Stop</button>
          <button v-else type="submit" class="btn small primary" :disabled="!canSend">Envoyer</button>
        </div>
      </form>
    </section>

    <VersionsSheet v-if="sheet === 'versions'" @close="sheet = null" />
    <ExportSheet v-if="sheet === 'export'" @close="sheet = null" />
    <ResetSheet v-if="sheet === 'reset'" @close="sheet = null" />
  </div>
</template>

<style scoped>
.workshop {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.stage {
  flex: 0 0 46dvh;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-bottom: 1px solid var(--line);
  background: var(--bg-elevated);
}
.stage-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: max(0.5rem, env(safe-area-inset-top)) 0.75rem 0.5rem;
  font-size: 0.82rem;
}
.status {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--copper);
  flex-shrink: 0;
}
.dot.live {
  background: var(--ok);
}
.stage-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.data-select {
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--bg-soft);
  padding: 0 0.5rem;
  font-size: 0.82rem;
}
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 1rem;
}
.device {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 0 0.75rem 0.75rem;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: #fff;
}
.placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 1rem;
  text-align: center;
  color: #6b6258;
  background: #f6f1ea;
}
.building {
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  overflow: hidden;
  background: rgba(212, 137, 74, 0.2);
}
.building span {
  position: absolute;
  inset: 0 auto 0 0;
  width: 35%;
  background: var(--copper);
  animation: slide 1.1s ease-in-out infinite;
}
.exit-full {
  position: fixed;
  left: 50%;
  bottom: max(16px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 70;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 244, 230, 0.4);
  background: rgba(20, 18, 16, 0.82);
  color: var(--text);
  backdrop-filter: blur(8px);
  cursor: pointer;
}
.workshop.fullscreen .stage {
  position: fixed;
  inset: 0;
  z-index: 60;
  flex: none;
}
.workshop.fullscreen .stage-bar {
  display: none;
}
.workshop.fullscreen .device {
  margin: 0;
  border: 0;
  border-radius: 0;
}

.panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.7rem 0.9rem 0.5rem;
}
.title {
  min-width: 0;
}
.title h1 {
  margin: 0;
  font-family: var(--serif);
  font-weight: 400;
  font-size: 1.45rem;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.head-actions {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
.menu-wrap {
  position: relative;
}
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 40;
  min-width: 220px;
  display: grid;
  padding: 0.35rem;
  border-radius: 14px;
  border: 1px solid var(--line-strong);
  background: var(--bg-elevated);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
}
.menu button {
  text-align: left;
  padding: 0.7rem 0.8rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
}
.menu button:hover {
  background: var(--bg-hover);
}
.notice {
  margin: 0 0.9rem 0.4rem;
}
.thread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.4rem 0.9rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.intro {
  margin: auto 0;
  padding: 1rem 0.2rem;
}
.intro p {
  margin: 0 0 0.5rem;
}
.big {
  font-size: 1.9rem;
  line-height: 1.1;
}
.bubble {
  max-width: 88%;
  padding: 0.65rem 0.85rem;
  border-radius: 16px;
  display: grid;
  gap: 0.4rem;
}
.bubble p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.bubble.user {
  align-self: flex-end;
  background: var(--copper-dim);
  border: 1px solid rgba(212, 137, 74, 0.3);
  border-bottom-right-radius: 6px;
}
.bubble.assistant {
  align-self: flex-start;
  background: var(--bg-soft);
  border: 1px solid var(--line);
  border-bottom-left-radius: 6px;
}
.bubble.assistant.failed {
  border-color: rgba(224, 138, 122, 0.4);
}
.thinking {
  animation: pulse 1.4s ease-in-out infinite;
}
.chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.chips li {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-family: var(--mono);
  background: var(--bg-hover);
  color: var(--muted);
  animation: pulse 1.2s ease-in-out infinite;
}
.chips li.done {
  animation: none;
  color: var(--text);
}
.chips li span {
  color: var(--copper);
}
.errors {
  margin: 0 0.9rem 0.5rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--danger-dim);
  border: 1px solid rgba(224, 138, 122, 0.35);
  font-size: 0.88rem;
}
.errors-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.errors-head strong {
  flex: 1;
}
.errors ul {
  margin: 0.5rem 0 0;
  padding-left: 1rem;
  display: grid;
  gap: 0.3rem;
  max-height: 140px;
  overflow-y: auto;
}
.errors code {
  font-family: var(--mono);
  font-size: 0.8rem;
  color: var(--copper);
}
.composer {
  padding: 0.5rem 0.75rem max(0.75rem, env(safe-area-inset-bottom));
  border-top: 1px solid var(--line);
  background: var(--bg-elevated);
  display: grid;
  gap: 0.5rem;
}
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.45rem;
}
.input-row textarea {
  flex: 1;
  min-height: 46px;
  max-height: 160px;
  resize: vertical;
  padding: 0.65rem 0.8rem;
  border-radius: 14px;
  border: 1px solid var(--line-strong);
  background: var(--bg-soft);
  font-size: 16px;
}
.input-row textarea:focus {
  outline: none;
  border-color: var(--copper);
}
.attach {
  height: 46px;
  width: 46px;
  font-size: 1.3rem;
}
.input-row .btn {
  min-height: 46px;
}
.attachments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
}
.attachments li {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.4rem 0.35rem 0.35rem;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--bg-soft);
  max-width: 260px;
}
.attachments img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 8px;
}
.attachments .meta {
  display: grid;
  min-width: 0;
  font-size: 0.8rem;
}
.attachments .name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.use {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--muted);
}
.use input {
  accent-color: var(--copper);
}
.remove {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 1.2rem;
  cursor: pointer;
}
.desktop-only {
  display: none;
}

@media (min-width: 960px) {
  .workshop {
    flex-direction: row-reverse;
  }
  .stage {
    flex: 1;
    border-bottom: 0;
    border-left: 1px solid var(--line);
  }
  .panel {
    flex: 0 0 440px;
  }
  .device {
    width: 100%;
    max-width: 430px;
    margin: 0 auto 1rem;
    align-self: center;
  }
  .device.wide {
    max-width: none;
    margin: 0 1rem 1rem;
    align-self: stretch;
  }
  .desktop-only {
    display: inline-block;
  }
}

@keyframes slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(300%);
  }
}
@keyframes pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
