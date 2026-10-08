<script setup lang="ts">
import { ref } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { dataApi } from '../services/data'
import { toDateStr } from '../utils/helpers'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ imported: []; close: [] }>()

const store = useTasksStore()

interface ParsedItem {
  title: string
  date: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  importance: number
  selected: boolean
}

const imageSrc = ref('')
const busy = ref(false)
const error = ref('')
const items = ref<ParsedItem[]>([])

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.readAsDataURL(file)
  })
}

async function onPick(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  imageSrc.value = await fileToDataUrl(file)
  items.value = []
  error.value = ''
  input.value = ''
}

async function onPaste(e: ClipboardEvent): Promise<void> {
  const files = e.clipboardData?.files
  if (!files || files.length === 0) return
  imageSrc.value = await fileToDataUrl(files[0])
  items.value = []
  error.value = ''
}

async function recognize(): Promise<void> {
  if (!imageSrc.value) return
  busy.value = true
  error.value = ''
  const res = await dataApi.aiImageToTasks(imageSrc.value)
  busy.value = false
  if (!res.ok) {
    error.value = res.error ?? '识别失败'
    return
  }
  const raw = (res.items ?? []) as Array<Record<string, unknown>>
  items.value = raw.map((r) => ({
    title: String(r.title ?? '未命名事项'),
    date: typeof r.date === 'string' && r.date ? r.date : null,
    startTime: typeof r.startTime === 'string' && r.startTime ? r.startTime : null,
    endTime: typeof r.endTime === 'string' && r.endTime ? r.endTime : null,
    location: typeof r.location === 'string' && r.location ? r.location : null,
    importance: Number(r.importance) || 3,
    selected: true
  }))
  if (items.value.length === 0) error.value = '没有识别到任何事项'
}

async function importSelected(): Promise<void> {
  for (const it of items.value.filter((i) => i.selected)) {
    await store.addTask({
      title: it.title,
      type: 'daily',
      kind: it.startTime ? 'schedule' : 'task',
      importance: it.importance,
      due: it.date ?? toDateStr(new Date()),
      startTime: it.startTime,
      endTime: it.endTime,
      location: it.location
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
    <p class="hint">上传课表 / 通知 / 便签截图，自动识别成任务。需先在「设置 → AI」填 API Key。</p>

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
        <button class="recog-btn" :disabled="!imageSrc || busy" @click="recognize">
          {{ busy ? '识别中…' : '识别图片' }}
        </button>
      </div>

      <div class="right">
        <p v-if="error" class="err">{{ error }}</p>
        <div v-if="items.length" class="results">
          <div v-for="(it, i) in items" :key="i" class="result">
            <input v-model="it.selected" type="checkbox" />
            <input v-model="it.title" class="r-title" />
            <input v-model="it.date" type="date" class="r-date" />
            <input v-model="it.startTime" type="time" class="r-time" />
            <input v-model="it.endTime" type="time" class="r-time" />
            <select v-model.number="it.importance" class="r-imp">
              <option :value="5">5</option>
              <option :value="4">4</option>
              <option :value="3">3</option>
              <option :value="2">2</option>
              <option :value="1">1</option>
            </select>
          </div>
          <button class="add-all" @click="importSelected">
            添加选中的 {{ items.filter((i) => i.selected).length }} 项
          </button>
        </div>
        <p v-else class="none">识别结果会显示在这里，可逐条修改后再添加。</p>
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
  width: 240px;
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
  min-height: 140px;
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
  max-height: 200px;
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
.right {
  flex: 1;
  min-width: 0;
}
.results {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.result {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.result input,
.result select {
  padding: 0.3rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
}
.r-title {
  flex: 1;
  min-width: 130px;
}
.r-time,
.r-date,
.r-imp {
  width: auto;
}
.add-all {
  align-self: flex-start;
  margin-top: 0.4rem;
  padding: 0.45rem 1rem;
  border: none;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
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
