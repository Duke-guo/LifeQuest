<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { dataApi } from '../services/data'
import { toDateStr } from '../utils/helpers'
import { REPEAT_LABELS, REPEAT_OPTIONS } from '../utils/schedule'
import AppIcon from './AppIcon.vue'
import type { RepeatMode } from '../../../shared/types'

const emit = defineEmits<{ imported: []; close: [] }>()

const store = useTasksStore()

interface Session {
  key: string
  weekday: number | null
  date: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  selected: boolean
}

interface CourseGroup {
  key: string
  name: string
  sessions: Session[]
  midterm: string
  final: string
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

let seq = 0
const nextKey = (): string => `k${++seq}`

function mondayOf(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + n))
}

const imageSrc = ref('')
const sendUrl = ref('')
const busy = ref(false)
const error = ref('')
const courses = ref<CourseGroup[]>([])

/** 重复区间：起始日（默认本周周一）→ 截止日（默认 +16 周） */
const weekAnchor = ref(toDateStr(mondayOf(new Date())))
const repeatUntil = ref(addDays(weekAnchor.value, 7 * 16))
const repeatMode = ref<RepeatMode>('weekly')
const globalMidterm = ref('')
const globalFinal = ref('')

const elapsed = ref(0)
let timer: number | undefined

const totalSessions = computed(() =>
  courses.value.reduce((n, c) => n + c.sessions.filter((s) => s.selected).length, 0)
)

async function shrink(dataUrl: string, maxDim = 1100, quality = 0.75): Promise<string> {
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = dataUrl
    })
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return dataUrl
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.readAsDataURL(file)
  })
}

async function useImage(dataUrl: string): Promise<void> {
  imageSrc.value = dataUrl
  sendUrl.value = await shrink(dataUrl)
  courses.value = []
  error.value = ''
}

async function onPick(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await useImage(await fileToDataUrl(file))
  input.value = ''
}

async function onPaste(e: ClipboardEvent): Promise<void> {
  const files = e.clipboardData?.files
  if (!files || files.length === 0) return
  await useImage(await fileToDataUrl(files[0]))
}

async function recognize(): Promise<void> {
  if (!sendUrl.value) return
  busy.value = true
  error.value = ''
  elapsed.value = 0
  timer = window.setInterval(() => (elapsed.value += 1), 1000)
  const started = Date.now()
  const res = await dataApi.aiImageToTasks(sendUrl.value)
  if (timer) window.clearInterval(timer)
  busy.value = false
  if (!res.ok) {
    error.value = `${res.error ?? '识别失败'}（耗时 ${((Date.now() - started) / 1000).toFixed(1)} 秒）`
    return
  }
  const raw = (res.items ?? []) as Array<Record<string, unknown>>
  const map = new Map<string, CourseGroup>()
  for (const r of raw) {
    const name = String(r.title ?? '未命名课程').trim()
    if (!map.has(name)) {
      map.set(name, { key: nextKey(), name, sessions: [], midterm: '', final: '' })
    }
    map.get(name)!.sessions.push({
      key: nextKey(),
      weekday: Number(r.weekday) >= 1 && Number(r.weekday) <= 7 ? Number(r.weekday) : null,
      date: typeof r.date === 'string' && r.date ? r.date : null,
      startTime: typeof r.startTime === 'string' && r.startTime ? r.startTime : null,
      endTime: typeof r.endTime === 'string' && r.endTime ? r.endTime : null,
      location: typeof r.location === 'string' && r.location ? r.location : null,
      selected: true
    })
  }
  courses.value = [...map.values()]
  if (courses.value.length === 0) error.value = '没有识别到任何课程'
}

/** 会话落地日期：图片给了日期就用它，否则用「起始日 + 星期几」推算 */
function resolvedDate(s: Session): string | null {
  if (s.date) return s.date
  if (s.weekday) return addDays(weekAnchor.value, s.weekday - 1)
  return null
}

function removeSession(c: CourseGroup, s: Session): void {
  c.sessions = c.sessions.filter((x) => x.key !== s.key)
  if (c.sessions.length === 0) courses.value = courses.value.filter((x) => x.key !== c.key)
}

function addSession(c: CourseGroup): void {
  c.sessions.push({
    key: nextKey(),
    weekday: 1,
    date: null,
    startTime: '08:00',
    endTime: '09:50',
    location: '',
    selected: true
  })
}

function addCourse(): void {
  courses.value.push({
    key: nextKey(),
    name: '新课程',
    sessions: [
      { key: nextKey(), weekday: 1, date: null, startTime: '08:00', endTime: '09:50', location: '', selected: true }
    ],
    midterm: '',
    final: ''
  })
}

function removeCourse(c: CourseGroup): void {
  courses.value = courses.value.filter((x) => x.key !== c.key)
}

async function importAll(): Promise<void> {
  const repeating = repeatMode.value !== 'none'
  for (const c of courses.value) {
    const name = c.name.trim() || '未命名课程'
    for (const s of c.sessions.filter((x) => x.selected)) {
      await store.addTask({
        title: name,
        type: 'daily',
        kind: s.startTime ? 'schedule' : 'task',
        importance: 3,
        due: resolvedDate(s),
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location?.trim() || null,
        remindMinutes: s.startTime ? 15 : null,
        repeat: repeating && s.weekday ? repeatMode.value : 'none',
        repeatUntil: repeating && s.weekday ? repeatUntil.value : null
      })
    }
    // 每门课各自的考核时间（作为最高重要度的主线事项，对应周自动显示为「考试周」）
    const mid = c.midterm || globalMidterm.value
    const fin = c.final || globalFinal.value
    if (mid) {
      await store.addTask({ title: `${name} · 期中考核`, type: 'main', kind: 'task', importance: 5, due: mid })
    }
    if (fin) {
      await store.addTask({ title: `${name} · 期末考核`, type: 'main', kind: 'task', importance: 5, due: fin })
    }
  }
  emit('imported')
}
</script>

<template>
  <section class="ai-panel card" tabindex="0" @paste="onPaste">
    <div class="ai-head">
      <h3><AppIcon name="sparkle" :size="17" /> AI 识图添加</h3>
      <button class="x" @click="emit('close')"><AppIcon name="close" :size="17" /></button>
    </div>
    <p class="hint">
      上传课表 / 通知 / 截图。识别结果按「课程」分组，一门课可以有多个上课时段，并可为每门课分别设置期中/期末时间。
    </p>

    <div class="ai-body">
      <div class="left">
        <label class="drop">
          <template v-if="!imageSrc">
            <AppIcon name="image" :size="28" />
            <span>点击选择图片 / 或在此 Ctrl+V 粘贴</span>
          </template>
          <img v-else :src="imageSrc" alt="待识别" />
          <input type="file" accept="image/*" hidden @change="onPick" />
        </label>
        <button class="recog-btn" :disabled="!sendUrl || busy" @click="recognize">
          {{ busy ? `识别中… ${elapsed}s` : '识别图片' }}
        </button>
        <p v-if="busy" class="tiny">网络不畅时会自动重试，最长约 45 秒</p>
      </div>

      <div class="right">
        <p v-if="error" class="err">{{ error }}</p>

        <div v-if="courses.length" class="settings-bar">
          <label class="sb-field">
            <span>起始</span>
            <input v-model="weekAnchor" type="date" />
          </label>
          <label class="sb-field">
            <span>截止</span>
            <input v-model="repeatUntil" type="date" />
          </label>
          <label class="sb-field">
            <span>重复</span>
            <select v-model="repeatMode">
              <option v-for="m in REPEAT_OPTIONS" :key="m" :value="m">{{ REPEAT_LABELS[m] }}</option>
            </select>
          </label>
          <button class="add-all" @click="importAll">添加 {{ courses.length }} 门课 / {{ totalSessions }} 个时段</button>
        </div>

        <div v-if="courses.length" class="defaults">
          <span class="sec-label">统一默认考核时间（各课程留空时使用）</span>
          <label class="sb-field">期中 <input v-model="globalMidterm" type="date" /></label>
          <label class="sb-field">期末 <input v-model="globalFinal" type="date" /></label>
        </div>

        <div v-if="courses.length" class="courses">
          <div v-for="c in courses" :key="c.key" class="course">
            <div class="course-head">
              <input v-model="c.name" class="course-name" />
              <span class="course-meta">{{ c.sessions.length }} 个时段</span>
              <button class="icon-btn" title="删除这门课" @click="removeCourse(c)">
                <AppIcon name="close" :size="15" />
              </button>
            </div>

            <div v-for="s in c.sessions" :key="s.key" class="session">
              <input v-model="s.selected" type="checkbox" />
              <select v-model.number="s.weekday" class="r-wd">
                <option :value="null">—</option>
                <option v-for="(w, wi) in WEEKDAYS" :key="w" :value="wi + 1">{{ w }}</option>
              </select>
              <input v-model="s.startTime" type="time" class="r-time" />
              <input v-model="s.endTime" type="time" class="r-time" />
              <input v-model="s.location" class="r-loc" placeholder="地点" />
              <span class="r-date" :class="{ warn: !resolvedDate(s) }">
                {{ resolvedDate(s) ?? '需选星期' }}
              </span>
              <button class="icon-btn" title="删除这个时段" @click="removeSession(c, s)">
                <AppIcon name="close" :size="14" />
              </button>
            </div>

            <div class="session-actions">
              <button class="ghost-mini" @click="addSession(c)">＋ 加一个时段</button>
              <label class="sb-field exam">期中 <input v-model="c.midterm" type="date" /></label>
              <label class="sb-field exam">期末 <input v-model="c.final" type="date" /></label>
            </div>
          </div>

          <button class="ghost-mini add-course" @click="addCourse">＋ 手动添加一门课程</button>
        </div>

        <p v-else class="none">识别结果会按课程显示在这里，可增删时段、逐条修改，并设置每门课的考核时间。</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ai-panel {
  margin-bottom: 1.25rem;
}
.ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ai-head h3 {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1rem;
}
.x {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}
.hint {
  color: var(--text-3);
  font-size: 0.82rem;
  margin: 0.4rem 0 0.8rem;
}
.ai-body {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}
.left {
  width: 210px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 130px;
  border: 2px dashed var(--border);
  border-radius: 12px;
  color: var(--text-3);
  font-size: 0.82rem;
  cursor: pointer;
  text-align: center;
  padding: 0.6rem;
  overflow: hidden;
}
.drop:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.drop img {
  max-width: 100%;
  max-height: 220px;
  border-radius: 8px;
}
.recog-btn {
  padding: 0.5rem;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}
.recog-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.tiny {
  font-size: 0.72rem;
  color: var(--text-3);
  margin: 0.2rem 0 0;
  text-align: center;
}
.right {
  flex: 1;
  min-width: 0;
}
.settings-bar,
.defaults {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  padding-bottom: 0.6rem;
  margin-bottom: 0.6rem;
  border-bottom: 1px solid var(--border);
}
.defaults {
  background: var(--surface-2);
  border-radius: 10px;
  padding: 0.5rem 0.7rem;
  border-bottom: none;
}
.sec-label {
  font-size: 0.78rem;
  color: var(--text-3);
  flex-basis: 100%;
}
.sb-field {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--text-2);
}
.sb-field input,
.sb-field select {
  padding: 0.28rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
}
.add-all {
  margin-left: auto;
  padding: 0.45rem 1rem;
  border: none;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}
.courses {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 400px;
  overflow-y: auto;
}
.course {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.6rem 0.7rem;
  background: var(--surface);
}
.course-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
}
.course-name {
  flex: 1;
  min-width: 0;
  padding: 0.3rem 0.45rem;
  border: none;
  border-bottom: 2px solid var(--border);
  background: none;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
  outline: none;
}
.course-name:focus {
  border-color: var(--accent);
}
.course-meta {
  font-size: 0.74rem;
  color: var(--text-3);
  white-space: nowrap;
}
.session {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0;
}
.session input,
.session select {
  padding: 0.26rem 0.34rem;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.78rem;
}
.r-wd {
  width: 66px;
}
.r-time {
  width: 78px;
}
.r-loc {
  flex: 1;
  min-width: 70px;
}
.r-date {
  font-size: 0.7rem;
  color: var(--text-3);
  width: 78px;
  flex-shrink: 0;
}
.r-date.warn {
  color: var(--danger);
}
.icon-btn {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  display: inline-flex;
  padding: 2px;
}
.icon-btn:hover {
  color: var(--danger);
}
.session-actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  margin-top: 0.45rem;
  padding-top: 0.45rem;
  border-top: 1px dashed var(--border);
}
.ghost-mini {
  border: 1px dashed var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 8px;
  padding: 0.25rem 0.6rem;
  font-size: 0.78rem;
  cursor: pointer;
}
.ghost-mini:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.add-course {
  align-self: flex-start;
}
.err {
  color: var(--danger);
  font-size: 0.82rem;
  margin: 0 0 0.5rem;
}
.none {
  color: var(--text-3);
  font-size: 0.82rem;
  margin: 0;
}
</style>
