<script setup lang="ts">
import { ref } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { dataApi } from '../services/data'
import { toDateStr } from '../utils/helpers'
import { REPEAT_LABELS, REPEAT_OPTIONS } from '../utils/schedule'
import AppIcon from './AppIcon.vue'
import type { RepeatMode } from '../../../shared/types'

const emit = defineEmits<{ imported: []; close: [] }>()

const store = useTasksStore()

interface ParsedItem {
  title: string
  weekday: number | null
  date: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  importance: number
  selected: boolean
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

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
const items = ref<ParsedItem[]>([])

/** 重复区间：起始日（默认本周周一）→ 截止日（默认 +16 周） */
const weekAnchor = ref(toDateStr(mondayOf(new Date())))
const repeatUntil = ref(addDays(weekAnchor.value, 7 * 16))
const repeatMode = ref<RepeatMode>('weekly')

/** 学期考核 */
const hasMidterm = ref(false)
const midtermDate = ref('')
const hasFinal = ref(false)
const finalDate = ref('')

const elapsed = ref(0)
let timer: number | undefined

/** 发送前压缩：长边限制 + JPEG 质量，避免请求体过大导致接口无法返回 */
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
  items.value = []
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
  items.value = raw.map((r) => ({
    title: String(r.title ?? '未命名事项'),
    weekday: Number(r.weekday) >= 1 && Number(r.weekday) <= 7 ? Number(r.weekday) : null,
    date: typeof r.date === 'string' && r.date ? r.date : null,
    startTime: typeof r.startTime === 'string' && r.startTime ? r.startTime : null,
    endTime: typeof r.endTime === 'string' && r.endTime ? r.endTime : null,
    location: typeof r.location === 'string' && r.location ? r.location : null,
    importance: Number(r.importance) || 3,
    selected: true
  }))
  if (items.value.length === 0) error.value = '没有识别到任何事项'
}

/** 最终落地的日期：图片里给了日期就用它，否则用「起始日 + 星期几」推算 */
function resolvedDate(it: ParsedItem): string | null {
  if (it.date) return it.date
  if (it.weekday) return addDays(weekAnchor.value, it.weekday - 1)
  return null
}

async function importSelected(): Promise<void> {
  for (const it of items.value.filter((i) => i.selected)) {
    const date = resolvedDate(it)
    const repeating = it.weekday && repeatMode.value !== 'none'
    await store.addTask({
      title: it.title,
      type: 'daily',
      kind: it.startTime ? 'schedule' : 'task',
      importance: it.importance,
      due: date,
      startTime: it.startTime,
      endTime: it.endTime,
      location: it.location,
      remindMinutes: it.startTime ? 15 : null,
      repeat: repeating ? repeatMode.value : 'none',
      repeatUntil: repeating && repeatUntil.value ? repeatUntil.value : null
    })
  }

  // 学期考核：建成最高重要度的主线事项（这样对应周会被日历概括为「考试周」）
  if (hasMidterm.value && midtermDate.value) {
    await store.addTask({
      title: '期中考核',
      type: 'main',
      kind: 'task',
      importance: 5,
      due: midtermDate.value
    })
  }
  if (hasFinal.value && finalDate.value) {
    await store.addTask({
      title: '期末考核',
      type: 'main',
      kind: 'task',
      importance: 5,
      due: finalDate.value
    })
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
      上传课表 / 通知 / 便签截图，自动识别成任务。课表会读出「星期几」，并按你设定的起止时间每周/每月重复。
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

        <div v-if="items.length" class="settings-bar">
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
              <option v-for="m in REPEAT_OPTIONS" :key="m" :value="m">
                {{ REPEAT_LABELS[m] }}
              </option>
            </select>
          </label>
          <button class="add-all" @click="importSelected">
            添加选中的 {{ items.filter((i) => i.selected).length }} 项
          </button>
        </div>

        <div v-if="items.length" class="exam-bar">
          <span class="exam-title">学期考核</span>
          <label class="sb-field">
            <input v-model="hasMidterm" type="checkbox" />
            期中
            <input v-model="midtermDate" type="date" :disabled="!hasMidterm" />
          </label>
          <label class="sb-field">
            <input v-model="hasFinal" type="checkbox" />
            期末
            <input v-model="finalDate" type="date" :disabled="!hasFinal" />
          </label>
          <span class="exam-hint">勾选后会建为最高重要度的主线事项，对应周会在日历上显示为「考试周」</span>
        </div>

        <div v-if="items.length" class="results">
          <div v-for="(it, i) in items" :key="i" class="result">
            <input v-model="it.selected" type="checkbox" class="r-check" />
            <input v-model="it.title" class="r-title" />
            <select v-model.number="it.weekday" class="r-wd">
              <option :value="null">—</option>
              <option v-for="(w, wi) in WEEKDAYS" :key="w" :value="wi + 1">{{ w }}</option>
            </select>
            <input v-model="it.startTime" type="time" class="r-time" />
            <input v-model="it.endTime" type="time" class="r-time" />
            <input v-model="it.location" class="r-loc" placeholder="地点" />
            <span class="r-date" :class="{ warn: !resolvedDate(it) }">
              {{ resolvedDate(it) ?? '需选星期' }}
            </span>
          </div>
        </div>

        <p v-else class="none">识别结果会显示在这里，可逐条修改星期/时间后再添加。</p>
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
  width: 220px;
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
.exam-bar {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
  padding-bottom: 0.6rem;
  margin-bottom: 0.6rem;
  border-bottom: 1px solid var(--border);
}
.exam-bar {
  padding: 0.5rem 0.7rem;
  background: var(--surface-2);
  border-radius: 10px;
  border-bottom: none;
}
.exam-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-2);
}
.exam-hint {
  font-size: 0.74rem;
  color: var(--text-3);
  flex-basis: 100%;
}
.sb-field {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: var(--text-2);
}
.sb-field input,
.sb-field select {
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.82rem;
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
.results {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 330px;
  overflow-y: auto;
}
.result {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.result input,
.result select {
  padding: 0.28rem 0.35rem;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.78rem;
}
.r-title {
  flex: 1;
  min-width: 120px;
}
.r-loc {
  width: 90px;
}
.r-wd {
  width: 66px;
}
.r-time {
  width: 78px;
}
.r-check {
  flex-shrink: 0;
}
.r-date {
  font-size: 0.72rem;
  color: var(--text-3);
  width: 82px;
  flex-shrink: 0;
}
.r-date.warn {
  color: var(--danger);
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
