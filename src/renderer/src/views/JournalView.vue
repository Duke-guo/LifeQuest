<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useJournalStore } from '../stores/journal'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useWeeklyJournalStore } from '../stores/weeklyJournal'
import { useTagsStore } from '../stores/tags'
import { useNotesStore } from '../stores/notes'
import { useLinksStore } from '../stores/links'
import { useSemesterStore } from '../stores/semester'
import { useConfirmStore } from '../stores/confirm'
import { WEATHER_META, MOOD_META } from '../utils/schedule'
import { toDateStr } from '../utils/helpers'
import AppIcon from '../components/AppIcon.vue'
import type { Weather, Mood, EntityRef } from '../../../shared/types'

const emit = defineEmits<{ openNote: [id: string] }>()

const store = useJournalStore()
const journalIndex = useJournalIndexStore()
const weekly = useWeeklyJournalStore()
const tagsStore = useTagsStore()
const notesStore = useNotesStore()
const linksStore = useLinksStore()
const semesterStore = useSemesterStore()
const confirm = useConfirmStore()

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

/** 日 / 周 切换：两个编辑器在同一页 */
const tab = ref<'day' | 'week'>('day')

onMounted(async () => {
  await tagsStore.load()
  await notesStore.list()
  await linksStore.load()
  if (!weekly.loaded) await weekly.load()
  if (!semesterStore.semester.start) await semesterStore.load()
  // 从日历/日记葡萄藤跳进来时，store 里已经是目标日期了，别覆盖成今天
  if (!store.loaded) await store.load(store.date || toDateStr(new Date()))
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

// ---------- 周记（与日记同一页，切一下就行） ----------
/** 这一周从周日开始 */
function sundayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return toDateStr(new Date(y, m - 1, d - dt.getDay()))
}
const weekStart = ref(sundayOf(toDateStr(new Date())))
const weekText = ref('')
const weekSaved = ref('')

function weekEndOf(start: string): string {
  const [y, m, d] = start.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + 6))
}

function weekLabel(start: string): string {
  const wk = semesterStore.weekOf(start)
  return wk ? `第 ${wk} 周` : `${start.slice(5)} 起`
}

async function loadWeek(start: string): Promise<void> {
  weekStart.value = start
  if (!weekly.loaded) await weekly.load()
  weekText.value = weekly.of(start)
}

function switchTab(t: 'day' | 'week'): void {
  tab.value = t
  // 切到周记时，直接落到「当前在看的那天」所在的周，而不是硬跳到本周
  if (t === 'week') void loadWeek(sundayOf(store.date))
}

function shiftWeek(days: number): void {
  const [y, m, d] = weekStart.value.split('-').map(Number)
  void loadWeek(toDateStr(new Date(y, m - 1, d + days)))
}

async function saveWeek(): Promise<void> {
  await weekly.save(weekStart.value, weekText.value)
  weekSaved.value = '已保存'
  window.setTimeout(() => (weekSaved.value = ''), 1800)
}

async function removeWeek(): Promise<void> {
  const ok = await confirm.ask({
    title: '删除这周的周记？',
    message: `${weekLabel(weekStart.value)} · ${weekStart.value} ~ ${weekEndOf(weekStart.value)}`,
    detail: '文件会从 journal/ 里删掉，无法恢复。',
    confirmText: '删除周记'
  })
  if (!ok) return
  await weekly.remove(weekStart.value)
  weekText.value = ''
}

// ---------- 关联笔记（B：把某篇笔记挂到这天的日记上） ----------
const journalRef = computed<EntityRef>(() => ({ kind: 'journal', id: store.date }))
const showLinks = ref(false)
const linkTarget = ref('')

const linkedNotes = computed(() =>
  linksStore.connectedTo(journalRef.value).filter((r) => r.kind === 'note')
)

const linkOptions = computed(() =>
  notesStore.notes
    .filter((n) => !linkedNotes.value.some((r) => r.id === n.id))
    .map((n) => ({ id: n.id, label: `${n.title}${n.date ? ' · ' + n.date.slice(5) : ''}` }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh'))
)

function noteTitle(id: string): string {
  return notesStore.byId(id)?.title ?? '（已删除的笔记）'
}

function linkFor(noteId: string): string | null {
  const l = linksStore
    .neighborsOf(journalRef.value)
    .find(
      (x) =>
        (x.to.kind === 'note' && x.to.id === noteId) ||
        (x.from.kind === 'note' && x.from.id === noteId)
    )
  return l?.id ?? null
}

async function addLink(): Promise<void> {
  const id = linkTarget.value
  if (!id) return
  await linksStore.add(journalRef.value, { kind: 'note', id })
  linkTarget.value = ''
}

async function removeLink(noteId: string): Promise<void> {
  const lid = linkFor(noteId)
  if (lid) await linksStore.remove(lid)
}
</script>

<template>
  <div class="journal-view">
    <header class="view-head">
      <div>
        <h2>日记 / 复盘</h2>
        <p class="sub">睡前写几句，天气和心情会同步染色到日历</p>
      </div>
      <div class="tabs">
        <button class="tab" :class="{ on: tab === 'day' }" @click="switchTab('day')">每日日记</button>
        <button class="tab" :class="{ on: tab === 'week' }" @click="switchTab('week')">周记</button>
      </div>
      <div v-if="tab === 'day'" class="date-nav">
        <button @click="shift(-1)">‹</button>
        <span class="date">{{ store.date }}<template v-if="isToday()">（今天）</template></span>
        <button @click="shift(1)">›</button>
        <button v-if="!isToday()" class="today-btn" @click="store.load(toDateStr(new Date()))">回今天</button>
      </div>
    </header>

    <!-- ============ 每日日记 ============ -->
    <template v-if="tab === 'day'">
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

      <!-- 关联笔记：正文右上角的 🔗，点开挂笔记 -->
      <section v-if="showLinks" class="panel card link-panel">
        <div class="link-head">
          <span class="picker-label">关联笔记（{{ linkedNotes.length }}）</span>
          <span class="link-sub">点笔记标题直接进入 · 和「关系图」里的连线是同一套</span>
        </div>
        <div v-if="linkedNotes.length === 0" class="link-none">还没有关联任何笔记</div>
        <span v-for="r in linkedNotes" :key="r.id" class="link-chip" title="点击进入这篇笔记">
          <button class="link-open" @click="emit('openNote', r.id)">{{ noteTitle(r.id) }}</button>
          <button class="tag-x" title="取消关联" @click="removeLink(r.id)">✕</button>
        </span>
        <select v-model="linkTarget" class="link-select" @change="addLink">
          <option value="">＋ 关联一篇笔记…</option>
          <option v-for="o in linkOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
      </section>

      <div class="editor-wrap">
        <textarea
          v-model="store.content"
          class="journal-editor"
          placeholder="今天发生了什么？完成了什么？有什么想记下的…"
        ></textarea>
        <button class="link-toggle" :class="{ on: showLinks }" title="把这天的日记和笔记关联起来" @click="showLinks = !showLinks">
          <AppIcon name="map" :size="15" /> 关联笔记 {{ linkedNotes.length ? `(${linkedNotes.length})` : '' }}
        </button>
      </div>

      <div class="actions">
        <button class="save-btn" @click="save">保存</button>
        <span v-if="savedHint" class="saved">{{ savedHint }}</span>
      </div>
    </template>

    <!-- ============ 周记 ============ -->
    <template v-else>
      <section class="panel card">
        <div class="week-nav">
          <button @click="shiftWeek(-7)">‹</button>
          <span class="date">{{ weekStart }} ~ {{ weekEndOf(weekStart) }} · {{ weekLabel(weekStart) }}</span>
          <button @click="shiftWeek(7)">›</button>
          <button class="today-btn" @click="loadWeek(sundayOf(toDateStr(new Date())))">回本周</button>
        </div>
      </section>

      <textarea
        v-model="weekText"
        class="journal-editor"
        placeholder="这一周做了什么、有什么值得记住的…"
      ></textarea>

      <div class="actions">
        <button v-if="weekly.has(weekStart)" class="ghost" @click="removeWeek">删除周记</button>
        <button class="save-btn" @click="saveWeek">保存周记</button>
        <span v-if="weekSaved" class="saved">{{ weekSaved }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.view-head {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  flex-wrap: wrap;
}
.tabs {
  display: flex;
  gap: 5px;
}
.tab {
  font-family: var(--font-display);
  font-size: 0.9rem;
  padding: 0.28rem 0.85rem;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  box-shadow: 0 2px 0 var(--surface-2);
  transition: transform 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}
.tab:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
  color: var(--accent);
}
.tab.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  box-shadow: 0 2px 0 var(--accent-soft);
}
.date-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}
.date-nav button,
.week-nav button {
  height: 30px;
  min-width: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.date-nav .today-btn,
.week-nav .today-btn {
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
/* 关联笔记面板 */
.link-panel {
  margin-top: 0.9rem;
}
.link-head {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.link-sub {
  font-size: 0.72rem;
  color: var(--text-3);
}
.link-none {
  font-size: 0.82rem;
  color: var(--text-3);
}
.link-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--surface-2);
  border-radius: 10px;
  padding: 2px 6px 2px 4px;
  font-size: 0.82rem;
}
.link-open {
  border: none;
  background: none;
  color: var(--accent);
  cursor: pointer;
  padding: 3px 4px;
  font-size: 0.82rem;
}
.link-open:hover {
  text-decoration: underline;
}
.link-select {
  max-width: 240px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  padding: 0.3rem 0.4rem;
  font-size: 0.85rem;
}
/* 正文 + 右上角的关联按钮 */
.editor-wrap {
  position: relative;
}
.link-toggle {
  position: absolute;
  top: 0.7rem;
  right: 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  border-radius: 999px;
  padding: 0.3rem 0.8rem;
  font-size: 0.8rem;
  cursor: pointer;
  opacity: 0.9;
}
.link-toggle.on,
.link-toggle:hover {
  background: var(--accent);
  color: #fff;
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
.week-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
.ghost {
  border: 1px solid var(--danger);
  background: none;
  color: var(--danger);
  border-radius: 10px;
  padding: 0.4rem 0.9rem;
  font-size: 0.85rem;
  cursor: pointer;
}
.saved {
  color: var(--success);
  font-size: 0.85rem;
}
</style>
