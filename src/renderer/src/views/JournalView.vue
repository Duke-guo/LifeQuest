<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useJournalStore } from '../stores/journal'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useTagsStore } from '../stores/tags'
import { WEATHER_META, MOOD_META } from '../utils/schedule'
import { toDateStr } from '../utils/helpers'
import AppIcon from '../components/AppIcon.vue'
import type { Weather, Mood } from '../../../shared/types'

const store = useJournalStore()
const journalIndex = useJournalIndexStore()
const tagsStore = useTagsStore()

const PROMPTS = [
  '今天最开心的一件事',
  '今天学到 / 收获了什么',
  '有什么让我困扰',
  '明天最重要的一件事',
  '今天想感谢谁'
]

const weathers: Weather[] = ['sunny', 'cloudy', 'rain', 'snow', 'wind', 'fog']
const moods: Mood[] = ['great', 'good', 'ok', 'low', 'bad']

const tagInput = ref('')
const savedHint = ref('')

onMounted(async () => {
  await tagsStore.load()
  await store.load(toDateStr(new Date()))
})

async function shift(days: number): Promise<void> {
  const [y, m, d] = store.date.split('-').map(Number)
  await store.load(toDateStr(new Date(y, m - 1, d + days)))
}

function isToday(): boolean {
  return store.date === toDateStr(new Date())
}

function addPrompt(p: string): void {
  const prefix = store.content.trim().length ? '\n\n' : ''
  store.content += `${prefix}## ${p}？\n`
}

async function save(): Promise<void> {
  await store.save()
  await journalIndex.load()
  savedHint.value = '已保存（天气/心情已同步到日历）'
  window.setTimeout(() => (savedHint.value = ''), 2500)
}

async function addTag(): Promise<void> {
  const v = tagInput.value.trim()
  if (!v) return
  if (!store.tags.includes(v)) store.tags.push(v)
  await tagsStore.ensure(v, 'theme')
  tagInput.value = ''
}

function removeTag(t: string): void {
  store.tags = store.tags.filter((x) => x !== t)
}
</script>

<template>
  <div class="journal-view">
    <header class="view-head">
      <div>
        <h2>日记 / 复盘</h2>
        <p class="sub">睡前写几句，天气和心情会同步染色到日历</p>
      </div>
      <div class="date-nav">
        <button @click="shift(-1)">‹</button>
        <span class="date">{{ store.date }}<template v-if="isToday()">（今天）</template></span>
        <button @click="shift(1)">›</button>
        <button v-if="!isToday()" class="today-btn" @click="store.load(toDateStr(new Date()))">回今天</button>
      </div>
    </header>

    <section class="panel card">
      <div class="picker-row">
        <span class="picker-label">天气</span>
        <button
          v-for="w in weathers"
          :key="w"
          class="pick"
          :class="{ on: store.weather === w }"
          :style="{ '--c': WEATHER_META[w].color }"
          :title="WEATHER_META[w].label"
          @click="store.weather = store.weather === w ? null : w"
        >
          <AppIcon :name="w" :size="19" />
        </button>

        <span class="picker-label mood-label">心情</span>
        <button
          v-for="m in moods"
          :key="m"
          class="pick"
          :class="{ on: store.mood === m }"
          :style="{ '--c': MOOD_META[m].color }"
          :title="MOOD_META[m].label"
          @click="store.mood = store.mood === m ? null : m"
        >
          <AppIcon :name="`mood-${m}`" :size="19" />
        </button>
      </div>

      <div class="prompts">
        <span class="picker-label">提示词</span>
        <button v-for="p in PROMPTS" :key="p" class="prompt-chip" @click="addPrompt(p)">＋ {{ p }}</button>
      </div>

      <div class="tag-row">
        <span class="picker-label">标签</span>
        <span v-for="t in store.tags" :key="t" class="tag-chip">
          {{ t }}
          <button class="tag-x" @click="removeTag(t)">✕</button>
        </span>
        <input
          v-model="tagInput"
          class="tag-input"
          placeholder="加标签后回车"
          @keyup.enter="addTag"
        />
      </div>
    </section>

    <textarea
      v-model="store.content"
      class="journal-editor"
      placeholder="今天发生了什么？完成了什么？有什么想记下的…"
    ></textarea>

    <div class="actions">
      <button class="save-btn" @click="save">保存</button>
      <span v-if="savedHint" class="saved">{{ savedHint }}</span>
    </div>
  </div>
</template>

<style scoped>
.date-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.date-nav button {
  height: 30px;
  min-width: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.date-nav .today-btn {
  padding: 0 0.7rem;
}
.date {
  font-weight: 600;
  min-width: 140px;
  text-align: center;
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.picker-row,
.prompts,
.tag-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.picker-label {
  font-size: 0.82rem;
  color: var(--text-2);
  margin-right: 0.2rem;
}
.mood-label {
  margin-left: 0.8rem;
}
.pick {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-3);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.pick:hover {
  transform: translateY(-2px);
  color: var(--c);
  border-color: var(--c);
}
.pick.on {
  color: var(--c);
  border-color: var(--c);
  background: color-mix(in srgb, var(--c) 14%, transparent);
  transform: scale(1.08);
}
.prompt-chip {
  border: 1px dashed var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 10px;
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
  cursor: pointer;
}
.prompt-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--accent-soft);
  color: var(--accent-text);
  border-radius: 10px;
  padding: 2px 6px 2px 9px;
  font-size: 0.8rem;
}
.tag-x {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0 2px;
}
.tag-input {
  border: none;
  border-bottom: 1px dashed var(--border);
  background: none;
  color: var(--text);
  padding: 0.25rem 0.2rem;
  font-size: 0.85rem;
  outline: none;
}
.journal-editor {
  width: 100%;
  min-height: 46vh;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  line-height: 1.75;
  resize: vertical;
}
.actions {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.save-btn {
  padding: 0.55rem 1.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}
.saved {
  color: var(--success);
  font-size: 0.85rem;
}
</style>
