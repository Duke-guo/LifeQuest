<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { useSeasonsStore } from '../stores/seasons'
import { useTagsStore } from '../stores/tags'
import { useSemesterStore } from '../stores/semester'
import { useConfirmStore } from '../stores/confirm'
import { findConflicts, conflictsOn, eventsFromTasks, nextOccurrence, REPEAT_LABELS, REPEAT_OPTIONS, type Conflict } from '../utils/schedule'
import { toDateStr } from '../utils/helpers'
import TaskItem from '../components/TaskItem.vue'
import TaskEditModal from '../components/TaskEditModal.vue'
import AddHistory from '../components/AddHistory.vue'
import AiImportPanel from '../components/AiImportPanel.vue'
import OccurrenceEditor from '../components/OccurrenceEditor.vue'
import AppIcon from '../components/AppIcon.vue'
import { noteFromTask } from '../utils/noteActions'
import type { TaskType, TaskKind, Task, RepeatMode, TaskOccurrence } from '../../../shared/types'

const emit = defineEmits<{
  openNote: [id: string]
  openCalendar: [date: string, mode?: 'day' | 'week', taskId?: string]
}>()

const store = useTasksStore()
const seasonsStore = useSeasonsStore()
const tagsStore = useTagsStore()
const semesterStore = useSemesterStore()
const confirm = useConfirmStore()

const title = ref('')
const type = ref<TaskType>('main')
const importance = ref(3)
const due = ref(toDateStr(new Date()))
const startTime = ref('')
const endTime = ref('')
const location = ref('')
/** 形式由「有没有填开始时间」自动决定：填了就是日程 */
const kind = computed<TaskKind>(() => (startTime.value ? 'schedule' : 'task'))
const seasonId = ref('')
const tagInput = ref('')
const tagIds = ref<string[]>([])
const remindMinutes = ref(0)
const dueTime = ref('')
const description = ref('')
const repeat = ref<RepeatMode>('none')
const repeatUntil = ref('')
/** 不规律重复：逐次日期 */
const occurrences = ref<TaskOccurrence[]>([])
const showOcc = ref(false)

const conflicts = ref<Conflict[]>([])
const pending = ref(false)
const showAi = ref(false)
const editing = ref<Task | null>(null)
/** 默认折叠全部列表，只看今天 */
const showAll = ref(false)

const sections: Array<{ type: TaskType; label: string }> = [
  { type: 'main', label: '主线 · 课程 / 长期目标' },
  { type: 'side', label: '支线 · 一次性任务' },
  { type: 'daily', label: '每日 · 习惯' }
]

onMounted(async () => {
  if (!store.loaded) await store.load()
  await seasonsStore.load()
  await tagsStore.load()
  await semesterStore.load()
})

const todayStr = toDateStr(new Date())
const todayConflicts = computed(() => conflictsOn(store.tasks, todayStr))

/** 今天实际发生的事项（含每周重复的课程） */
const todayTasks = computed(() => {
  const evs = eventsFromTasks(store.tasks, todayStr, todayStr, semesterStore.noClassDates)
  const ids = new Set(evs.map((e) => e.refId))
  return store.tasks
    .filter((t) => ids.has(t.id))
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (b.status === 'done' && a.status !== 'done') return -1
      return (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99')
    })
})

function buildCandidate(): Partial<Task> {
  return {
    id: 'new',
    kind: kind.value,
    due: due.value || null,
    dueTime: kind.value === 'task' && dueTime.value ? dueTime.value : null,
    startTime: kind.value === 'schedule' ? startTime.value : null,
    endTime: kind.value === 'schedule' ? endTime.value : null
  }
}

async function submit(force = false): Promise<void> {
  const t = title.value.trim()
  if (!t) return

  if (kind.value === 'schedule' && !force) {
    const found = findConflicts(store.tasks, buildCandidate() as Task)
    if (found.length > 0) {
      conflicts.value = found
      pending.value = true
      return
    }
  }

  await store.addTask({
    title: t,
    type: type.value,
    kind: kind.value,
    importance: importance.value,
    due: due.value || null,
    dueTime: kind.value === 'task' && dueTime.value ? dueTime.value : null,
    startTime: kind.value === 'schedule' ? startTime.value : null,
    endTime: kind.value === 'schedule' ? endTime.value : null,
    location: location.value.trim() || null,
    seasonId: seasonId.value || null,
    remindMinutes: remindMinutes.value || null,
    description: description.value.trim(),
    tagIds: tagIds.value,
    repeat: repeat.value,
    repeatUntil: repeat.value !== 'none' && repeatUntil.value ? repeatUntil.value : null,
    occurrences: occurrences.value.filter((o) => o.date)
  })

  title.value = ''
  location.value = ''
  description.value = ''
  occurrences.value = []
  conflicts.value = []
  pending.value = false
}

function cancelPending(): void {
  pending.value = false
  conflicts.value = []
}

async function addTag(): Promise<void> {
  const v = tagInput.value.trim()
  if (!v) return
  const tag = await tagsStore.ensure(v, 'custom')
  if (!tagIds.value.includes(tag.id)) tagIds.value.push(tag.id)
  tagInput.value = ''
}

function removeTag(id: string): void {
  tagIds.value = tagIds.value.filter((x) => x !== id)
}

async function onAiImported(): Promise<void> {
  await store.load()
  showAi.value = false
}

/** 一键为这件事/这节课写笔记 */
async function writeNote(t: Task): Promise<void> {
  const id = await noteFromTask(t)
  emit('openNote', id)
}

/** 删除任务前先确认（误删还能在「历史添加」里找回） */
async function removeTask(t: Task): Promise<void> {
  const ok = await confirm.ask({
    title: '删除这件事？',
    message: `「${t.title}」`,
    detail: '删掉后可以在本页「历史添加」里一键找回。',
    confirmText: '删除'
  })
  if (!ok) return
  await store.removeTask(t.id)
}

/** 跳去日历，定位到这件事所在的（或将来最近的）那一周 */
function locate(t: Task): void {
  const date = nextOccurrence(t, todayStr, semesterStore.noClassDates) ?? t.due
  if (date) emit('openCalendar', date, 'week', t.id)
}
</script>

<template>
  <div class="tasks-view">
    <header class="view-head">
      <div>
        <h2>任务 / 日程</h2>
        <p class="sub">任务粗略、日程精确到时段；重要度越高罗盘指针越朝上</p>
      </div>
      <button class="ai-btn" @click="showAi = !showAi">
        <AppIcon name="camera" :size="16" /> AI 识图添加
      </button>
    </header>

    <!-- 今日冲突提示 -->
    <div v-if="todayConflicts.length" class="warn-bar">
      <AppIcon name="guide" :size="17" />
      <span
        >今天有 {{ todayConflicts.length }} 处时间冲突：{{
          todayConflicts.map((c) => `${c.a.title} ↔ ${c.b.title}`).join('；')
        }}</span
      >
    </div>

    <AiImportPanel v-if="showAi" @imported="onAiImported" @close="showAi = false" />

    <form class="task-form card" @submit.prevent="submit()">
      <div class="row">
        <input v-model="title" class="title-input" placeholder="新增事项，回车确认…" />
        <button type="submit" class="add-btn">添加</button>
      </div>

      <div class="row">
        <div class="seg type-seg">
          <button
            v-for="(t, key) in ({ main: '主线', side: '支线', daily: '每日' } as Record<TaskType, string>)"
            :key="key"
            type="button"
            :class="{ on: type === key }"
            :title="key === 'main' ? '课程 / 长期主线' : key === 'side' ? '一次性任务 / 小目标' : '每天重复的小习惯'"
            @click="type = key"
          >
            {{ t }}
          </button>
        </div>
        <select v-model="importance">
          <option :value="5">5 · 最重要</option>
          <option :value="4">4 · 重要</option>
          <option :value="3">3 · 一般</option>
          <option :value="2">2 · 次要</option>
          <option :value="1">1 · 低</option>
        </select>
        <input v-model="due" type="date" :title="kind === 'schedule' ? '日期' : '截止日期'" />
        <input v-model="startTime" type="time" :title="kind === 'schedule' ? '开始时间' : '填开始时间即成为日程'" />
        <span class="dash">–</span>
        <input v-model="endTime" type="time" title="结束时间" />
        <label v-if="kind === 'task'" class="inline-field" title="只有截止时间的事项：日历上会插一面小旗，留空＝当天 24:00">
          <span>截止时刻</span>
          <input v-model="dueTime" type="time" />
        </label>
        <input v-model="location" class="loc-input" placeholder="地点（可选）" />
        <label class="inline-field">
          <span>提前提醒</span>
          <select v-model.number="remindMinutes">
            <option :value="0">不提醒</option>
            <option :value="5">5 分钟</option>
            <option :value="15">15 分钟</option>
            <option :value="30">30 分钟</option>
            <option :value="60">1 小时</option>
          </select>
        </label>
        <select v-model="seasonId">
          <option value="">无赛季</option>
          <option v-for="s in seasonsStore.seasons" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>
      <p class="form-hint">
        {{ kind === 'schedule' ? '已填时间 → 会作为「日程」精确排在日历上' : '不填时间就是「任务」（粗略）；填上开始时间会自动变成「日程」' }}
      </p>

      <div class="row repeat-row">
        <label class="inline-field">
          <span>重复</span>
          <select v-model="repeat">
            <option v-for="m in REPEAT_OPTIONS" :key="m" :value="m">{{ REPEAT_LABELS[m] }}</option>
          </select>
        </label>
        <template v-if="repeat !== 'none'">
          <label class="inline-field">
            <span>截止</span>
            <input v-model="repeatUntil" type="date" />
          </label>
          <span class="range-hint">
            从上面的日期起「{{ REPEAT_LABELS[repeat] }}」重复到截止日（留空表示不限）
          </span>
        </template>
      </div>

      <!-- 不规律重复：逐次列日期 -->
      <div class="row occ-row-wrap">
        <button type="button" class="occ-toggle" @click="showOcc = !showOcc">
          {{ showOcc ? '收起按次填写' : '＋ 按具体日期添加（不规律）' }}
          <span v-if="occurrences.length" class="occ-count">{{ occurrences.length }}</span>
        </button>
        <span v-if="!showOcc && occurrences.length" class="range-hint">
          已加 {{ occurrences.length }} 次
        </span>
      </div>
      <div v-if="showOcc" class="row occ-editor">
        <OccurrenceEditor v-model="occurrences" />
      </div>

      <div class="row tags-row">
        <span v-for="id in tagIds" :key="id" class="tag-chip" :style="{ '--c': tagsStore.byId(id)?.color }">
          {{ tagsStore.byId(id)?.name }}
          <button type="button" class="tag-x" @click="removeTag(id)">✕</button>
        </span>
        <input v-model="tagInput" class="tag-input" placeholder="＋ 标签（回车）" @keyup.enter="addTag" />
      </div>

      <!-- 详情：内容可能很长，收在下面，和「编辑事项」里的一致 -->
      <div class="row detail-row">
        <label class="detail-field">
          <span>详情（可选，可以很长）</span>
          <textarea
            v-model="description"
            class="detail-input"
            rows="2"
            placeholder="要求 / 注意事项 / 链接……"
          ></textarea>
        </label>
      </div>

      <!-- 冲突确认 -->
      <div v-if="pending" class="conflict-box">
        <strong>⚠ 时间冲突</strong>
        <ul>
          <li v-for="(c, i) in conflicts" :key="i">
            与「{{ c.b.title }}」（{{ c.b.startTime }}–{{ c.b.endTime }}）时间重叠
          </li>
        </ul>
        <div class="conflict-actions">
          <button type="button" class="ghost" @click="cancelPending">取消</button>
          <button type="button" class="add-btn" @click="submit(true)">仍然添加</button>
        </div>
      </div>

      <AddHistory />
    </form>

    <!-- 今天 -->
    <section class="task-section today-sec">
      <div class="today-head">
        <h3>今天 · {{ todayTasks.length }} 项</h3>
        <button class="expand-btn" type="button" @click="showAll = !showAll">
          {{ showAll ? '收起全部' : '展开全部任务' }}
          <AppIcon :name="showAll ? 'back' : 'plus'" :size="14" />
        </button>
      </div>
      <div v-if="todayTasks.length === 0" class="empty">今天没有安排，休息一下也很好。</div>
      <TaskItem
        v-for="t in todayTasks"
        :key="t.id"
        :task="t"
        @toggle="store.setStatus(t.id, t.status === 'done' ? 'todo' : 'done')"
        @remove="removeTask(t)"
        @edit="editing = t"
        @note="writeNote(t)"
        @locate="locate(t)"
      />
    </section>

    <template v-if="showAll">
      <section v-for="s in sections" :key="s.type" class="task-section">
        <h3>{{ s.label }}</h3>
        <div v-if="store.byType(s.type).length === 0" class="empty">暂无</div>
        <TaskItem
          v-for="t in store.byType(s.type)"
          :key="t.id"
          :task="t"
          @toggle="store.setStatus(t.id, t.status === 'done' ? 'todo' : 'done')"
          @remove="removeTask(t)"
          @edit="editing = t"
          @note="writeNote(t)"
        @locate="locate(t)"
        />
      </section>
    </template>

    <TaskEditModal v-if="editing" :task="editing" @close="editing = null" />
  </div>
</template>

<style scoped>
.ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}
.warn-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(217, 80, 80, 0.12);
  color: var(--danger);
  border-radius: 10px;
  padding: 0.55rem 0.9rem;
  margin-bottom: 1rem;
  font-size: 0.85rem;
}
.task-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.title-input {
  flex: 1;
  min-width: 200px;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
}
select,
input[type='date'],
input[type='time'] {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
}
.loc-input {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  width: 110px;
}
.dash {
  color: var(--text-3);
}
.seg {
  display: flex;
  background: var(--surface-2);
  border-radius: 10px;
  padding: 2px;
}
.seg button {
  border: none;
  background: none;
  padding: 0.4rem 0.9rem;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-2);
  font-size: 0.85rem;
}
.seg button.on {
  background: var(--surface);
  color: var(--accent);
  font-weight: 600;
}
.tags-row {
  gap: 0.4rem;
}
.form-hint {
  margin: 0.45rem 0 0;
  font-size: 0.74rem;
  color: var(--text-3);
}
.occ-toggle {
  border: 1px dashed var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 9px;
  padding: 0.3rem 0.7rem;
  font-size: 0.82rem;
  cursor: pointer;
}
.occ-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.occ-count {
  font-family: var(--font-num);
  font-weight: 700;
  color: var(--accent);
  margin-left: 0.2rem;
}
.occ-editor {
  margin-top: 0.4rem;
}
.detail-row {
  margin-top: 0.5rem;
}
.detail-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
  font-size: 0.75rem;
  color: var(--text-3);
}
.detail-input {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.86rem;
  line-height: 1.6;
  resize: vertical;
}
.repeat-row {
  gap: 0.7rem;
}
.inline-field {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--text-2);
}
.range-hint {
  font-size: 0.78rem;
  color: var(--text-3);
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 10px;
  padding: 2px 6px 2px 9px;
  font-size: 0.78rem;
  color: #fff;
  background: var(--c, var(--text-3));
}
.tag-x {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.7rem;
}
.tag-input {
  border: none;
  border-bottom: 1px dashed var(--border);
  background: none;
  color: var(--text);
  padding: 0.25rem 0.2rem;
  font-size: 0.82rem;
  outline: none;
  min-width: 120px;
}
.add-btn {
  padding: 0.55rem 1.1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}
.conflict-box {
  border: 1px solid rgba(217, 80, 80, 0.4);
  background: rgba(217, 80, 80, 0.08);
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  font-size: 0.85rem;
}
.conflict-box ul {
  margin: 0.4rem 0 0.6rem;
  padding-left: 1.1rem;
}
.conflict-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
.ghost {
  padding: 0.45rem 1rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 10px;
  cursor: pointer;
}
.task-section {
  margin-bottom: 1.5rem;
}
.task-section h3 {
  font-size: 1rem;
  color: var(--text-2);
  margin-bottom: 0.6rem;
}
.today-sec {
  border-top: 1px solid var(--border);
  padding-top: 1rem;
}
.today-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}
.today-head h3 {
  margin-bottom: 0;
  color: var(--text);
  font-size: 1.05rem;
}
.expand-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.82rem;
}
.expand-btn:hover {
  background: var(--accent-soft);
}
</style>
