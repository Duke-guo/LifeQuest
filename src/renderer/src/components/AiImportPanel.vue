<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { useSemesterStore } from '../stores/semester'
import { dataApi } from '../services/data'
import { toDateStr } from '../utils/helpers'
import { REPEAT_LABELS, REPEAT_OPTIONS, everyNDays } from '../utils/schedule'
import AppIcon from './AppIcon.vue'
import DateField from './DateField.vue'
import TimeField from './TimeField.vue'
import type { RepeatMode } from '../../../shared/types'

const emit = defineEmits<{ imported: []; close: [] }>()

const store = useTasksStore()
const semesterStore = useSemesterStore()

onMounted(async () => {
  if (!semesterStore.loaded) await semesterStore.load()
  // 默认区间直接取自「学期计划」：开学日 → 教学最后一天
  if (semesterStore.start) globalFrom.value = semesterStore.start
  if (semesterStore.teachingEnd) globalUntil.value = semesterStore.teachingEnd
})

/** 从校历图片导入：已改为直接读学期配置，不再走 AI */

interface Session {
  key: string
  weekday: number | null
  startTime: string | null
  endTime: string | null
  location: string | null
  selected: boolean
}

interface ExamInfo {
  date: string
  startTime: string
  endTime: string
  location: string
}

interface CourseGroup {
  key: string
  name: string
  sessions: Session[]
  /** 这门课的上课起止（空则用全局默认） */
  from: string
  until: string
  midterm: ExamInfo
  final: ExamInfo
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

let seq = 0
const nextKey = (): string => `k${++seq}`
const emptyExam = (): ExamInfo => ({ date: '', startTime: '', endTime: '', location: '' })

function mondayOf(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + n))
}

/** 从 from 起（含当天）第一个落在指定星期几的日期；weekday 1=周一 … 7=周日 */
function firstOnOrAfter(fromIso: string, weekday: number): string {
  if (!fromIso) return ''
  const [y, m, d] = fromIso.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  const cur = base.getDay() === 0 ? 7 : base.getDay()
  const diff = (weekday - cur + 7) % 7
  return toDateStr(new Date(y, m - 1, d + diff))
}

const imageSrc = ref('')
const sendUrl = ref('')
const busy = ref(false)
const error = ref('')
const courses = ref<CourseGroup[]>([])

/** 全局默认：上课起始（默认本周周一）→ 截止（默认 +16 周） */
const globalFrom = ref(toDateStr(mondayOf(new Date())))
const globalUntil = ref(addDays(globalFrom.value, 7 * 16))
const repeatMode = ref<RepeatMode>('weekly')
/** repeatMode = 'every-n' 时：隔几天一次 */
const repeatEvery = ref(2)

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
      map.set(name, {
        key: nextKey(),
        name,
        sessions: [],
        from: '',
        until: '',
        midterm: emptyExam(),
        final: emptyExam()
      })
    }
    map.get(name)!.sessions.push({
      key: nextKey(),
      weekday: Number(r.weekday) >= 1 && Number(r.weekday) <= 7 ? Number(r.weekday) : null,
      startTime: typeof r.startTime === 'string' && r.startTime ? r.startTime : null,
      endTime: typeof r.endTime === 'string' && r.endTime ? r.endTime : null,
      location: typeof r.location === 'string' && r.location ? r.location : null,
      selected: true
    })
  }
  courses.value = [...map.values()]
  if (courses.value.length === 0) error.value = '没有识别到任何课程'
}

function courseFrom(c: CourseGroup): string {
  return c.from || globalFrom.value
}

function courseUntil(c: CourseGroup): string {
  return c.until || globalUntil.value
}

/** 某个时段第一次上课的日期 */
function sessionDate(c: CourseGroup, s: Session): string | null {
  if (!s.weekday) return null
  return firstOnOrAfter(courseFrom(c), s.weekday)
}

function removeSession(c: CourseGroup, s: Session): void {
  c.sessions = c.sessions.filter((x) => x.key !== s.key)
  if (c.sessions.length === 0) courses.value = courses.value.filter((x) => x.key !== c.key)
}

function addSession(c: CourseGroup): void {
  c.sessions.push({ key: nextKey(), weekday: 1, startTime: '08:00', endTime: '09:50', location: '', selected: true })
}

function addCourse(): void {
  courses.value.push({
    key: nextKey(),
    name: '新课程',
    sessions: [
      { key: nextKey(), weekday: 1, startTime: '08:00', endTime: '09:50', location: '', selected: true }
    ],
    from: '',
    until: '',
    midterm: emptyExam(),
    final: emptyExam()
  })
}

function removeCourse(c: CourseGroup): void {
  courses.value = courses.value.filter((x) => x.key !== c.key)
}

async function importAll(): Promise<void> {
  const repeating = repeatMode.value !== 'none'
  for (const c of courses.value) {
    const name = c.name.trim() || '未命名课程'
    const until = courseUntil(c)

    for (const s of c.sessions.filter((x) => x.selected)) {
      const date = sessionDate(c, s)
      if (!date) continue
      await store.addTask({
        title: name,
        type: 'main',
        kind: s.startTime ? 'schedule' : 'task',
        importance: 3,
        due: date,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location?.trim() || null,
        remindMinutes: s.startTime ? 15 : null,
        repeat: repeating ? repeatMode.value : 'none',
        repeatEvery: repeatMode.value === 'every-n' ? everyNDays({ repeatEvery: repeatEvery.value }) : null,
        repeatUntil: repeating && until ? until : null
      })
    }

    // 考试作为独立的一次性日程（有自己的日期、时段、地点）
    for (const [label, exam] of [
      ['期中考核', c.midterm],
      ['期末考核', c.final]
    ] as const) {
      if (!exam.date) continue
      await store.addTask({
        title: `${name} · ${label}`,
        type: 'main',
        kind: exam.startTime ? 'schedule' : 'task',
        importance: 5,
        due: exam.date,
        startTime: exam.startTime || null,
        endTime: exam.endTime || null,
        location: exam.location.trim() || null,
        remindMinutes: exam.startTime ? 30 : null
      })
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
      识别结果按「课程」分组。每门课可设<b>上课起止</b>（如第 1–20 周），考核另设<b>日期 + 时段 + 地点</b>（如第 21 周某天）。
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
        <p v-if="busy" class="tiny">课表越密，模型思考越久，通常 10~40 秒，请稍候</p>
      </div>

      <div class="right">
        <p v-if="error" class="err">{{ error }}</p>

        <div class="cal-bar">
          <span class="sem-info">
            学期计划：{{ semesterStore.semester.name }} · {{ semesterStore.start }} ~
            {{ semesterStore.teachingEnd }}（考试 {{ semesterStore.semester.examStart || '?' }}~{{
              semesterStore.semester.examEnd || '?'
            }}）
          </span>
          <span class="sem-hint">可在「计划」页调整开学日 / 教学结束 / 考试周 / 假期</span>
        </div>
        <p v-if="semesterStore.semester.holidays.length" class="holiday-list">
          停课日：{{
            semesterStore.semester.holidays
              .map((h) => `${h.name} ${h.start.slice(5)}~${h.end.slice(5)}`)
              .join('、')
          }}（这些日期不排课）
        </p>

        <div v-if="courses.length" class="settings-bar">
          <label class="sb-field"><span>默认起始</span><DateField v-model="globalFrom" /></label>
          <label class="sb-field"><span>默认截止</span><DateField v-model="globalUntil" /></label>
          <label class="sb-field">
            <span>重复</span>
            <select v-model="repeatMode">
              <option v-for="m in REPEAT_OPTIONS" :key="m" :value="m">{{ REPEAT_LABELS[m] }}</option>
            </select>
          </label>
          <span v-if="repeatMode === 'every-n'" class="every-wrap">
            每 <input v-model.number="repeatEvery" type="number" min="1" max="180" class="c-num" /> 天
          </span>
          <button class="add-all" @click="importAll">添加 {{ courses.length }} 门课 / {{ totalSessions }} 个时段</button>
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
              <TimeField v-model="s.startTime" placeholder="开始" />
              <TimeField v-model="s.endTime" placeholder="结束" end-of-day />
              <input v-model="s.location" class="r-loc" placeholder="地点" />
              <span class="r-date" :class="{ warn: !sessionDate(c, s) }">
                {{ sessionDate(c, s) ?? '需选星期' }}
              </span>
              <button class="icon-btn" title="删除这个时段" @click="removeSession(c, s)">
                <AppIcon name="close" :size="14" />
              </button>
            </div>

            <div class="course-foot">
              <button class="ghost-mini" @click="addSession(c)">＋ 加一个时段</button>
              <label class="sb-field">
                <span>上课期间</span>
                <DateField v-model="c.from" :placeholder="globalFrom || '起始'" />
                <em>~</em>
                <DateField v-model="c.until" :placeholder="globalUntil || '截止'" />
              </label>
            </div>

            <div class="exam-row">
              <span class="exam-label">期中</span>
              <DateField v-model="c.midterm.date" placeholder="考试日期" />
              <TimeField v-model="c.midterm.startTime" placeholder="开始" />
              <TimeField v-model="c.midterm.endTime" placeholder="结束" end-of-day />
              <input v-model="c.midterm.location" class="ex-loc" placeholder="考场" />
            </div>
            <div class="exam-row">
              <span class="exam-label">期末</span>
              <DateField v-model="c.final.date" placeholder="考试日期" />
              <TimeField v-model="c.final.startTime" placeholder="开始" />
              <TimeField v-model="c.final.endTime" placeholder="结束" end-of-day />
              <input v-model="c.final.location" class="ex-loc" placeholder="考场" />
            </div>
          </div>

          <button class="ghost-mini add-course" @click="addCourse">＋ 手动添加一门课程</button>
        </div>

        <p v-else class="none">识别结果会按课程显示在这里，可增删时段、设置每门课的上课起止与考核时间。</p>
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
  width: 200px;
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
  max-height: 240px;
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
.settings-bar {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  padding-bottom: 0.6rem;
  margin-bottom: 0.6rem;
  border-bottom: 1px solid var(--border);
}
.sb-field {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--text-2);
}
.sb-field em {
  font-style: normal;
  color: var(--text-3);
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
/* 「每 N 天」小方框 */
.every-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--text-2);
}
.c-num {
  width: 52px;
  text-align: center;
  font-family: var(--font-num);
  padding: 0.28rem 0.3rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
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
.cal-btn {
  cursor: pointer;
}
.cal-bar {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}
.sem-info {
  font-size: 0.8rem;
  color: var(--text-2);
}
.sem-hint {
  font-size: 0.74rem;
  color: var(--text-3);
}
.cal-msg {
  font-size: 0.8rem;
  color: var(--success);
}
.holiday-list {
  font-size: 0.78rem;
  color: var(--text-3);
  margin: 0 0 0.6rem;
  padding: 0.4rem 0.6rem;
  background: var(--surface-2);
  border-radius: 8px;
}
.courses {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 430px;
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
.session,
.exam-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.14rem 0;
}
.session input,
.session select,
.exam-row input {
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
.exam-row {
  margin-top: 0.15rem;
}
.exam-label {
  font-size: 0.76rem;
  color: var(--text-2);
  width: 30px;
  flex-shrink: 0;
}
.ex-loc {
  flex: 1;
  min-width: 70px;
}
.course-foot {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
  margin: 0.5rem 0;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border);
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
