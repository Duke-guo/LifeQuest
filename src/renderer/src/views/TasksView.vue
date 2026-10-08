<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { useSeasonsStore } from '../stores/seasons'
import { useTagsStore } from '../stores/tags'
import { findConflicts, conflictsOn, REPEAT_LABELS, REPEAT_OPTIONS, type Conflict } from '../utils/schedule'
import { toDateStr } from '../utils/helpers'
import TaskItem from '../components/TaskItem.vue'
import TaskEditModal from '../components/TaskEditModal.vue'
import AiImportPanel from '../components/AiImportPanel.vue'
import AppIcon from '../components/AppIcon.vue'
import type { TaskType, TaskKind, Task, RepeatMode } from '../../../shared/types'

const store = useTasksStore()
const seasonsStore = useSeasonsStore()
const tagsStore = useTagsStore()

const title = ref('')
const type = ref<TaskType>('daily')
const kind = ref<TaskKind>('task')
const importance = ref(3)
const due = ref(toDateStr(new Date()))
const startTime = ref('09:00')
const endTime = ref('10:00')
const location = ref('')
const seasonId = ref('')
const tagInput = ref('')
const tagIds = ref<string[]>([])
const repeat = ref<RepeatMode>('none')
const repeatUntil = ref('')

const conflicts = ref<Conflict[]>([])
const pending = ref(false)
const showAi = ref(false)
const editing = ref<Task | null>(null)

const sections: Array<{ type: TaskType; label: string }> = [
  { type: 'main', label: '主线任务' },
  { type: 'side', label: '支线任务' },
  { type: 'daily', label: '每日任务' }
]

onMounted(async () => {
  if (!store.loaded) await store.load()
  await seasonsStore.load()
  await tagsStore.load()
})

const todayStr = toDateStr(new Date())
const todayConflicts = computed(() => conflictsOn(store.tasks, todayStr))

function buildCandidate(): Partial<Task> {
  return {
    id: 'new',
    kind: kind.value,
    due: due.value || null,
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
    startTime: kind.value === 'schedule' ? startTime.value : null,
    endTime: kind.value === 'schedule' ? endTime.value : null,
    location: location.value.trim() || null,
    seasonId: seasonId.value || null,
    tagIds: tagIds.value,
    repeat: repeat.value,
    repeatUntil: repeat.value !== 'none' && repeatUntil.value ? repeatUntil.value : null
  })

  title.value = ''
  location.value = ''
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
        <div class="seg">
          <button type="button" :class="{ on: kind === 'task' }" @click="kind = 'task'">任务</button>
          <button type="button" :class="{ on: kind === 'schedule' }" @click="kind = 'schedule'">日程</button>
        </div>
        <select v-model="type">
          <option value="main">主线</option>
          <option value="side">支线</option>
          <option value="daily">每日</option>
        </select>
        <select v-model="importance">
          <option :value="5">5 · 最重要</option>
          <option :value="4">4 · 重要</option>
          <option :value="3">3 · 一般</option>
          <option :value="2">2 · 次要</option>
          <option :value="1">1 · 低</option>
        </select>
        <input v-model="due" type="date" :title="kind === 'schedule' ? '日期' : '截止日期'" />
        <template v-if="kind === 'schedule'">
          <input v-model="startTime" type="time" title="开始" />
          <span class="dash">–</span>
          <input v-model="endTime" type="time" title="结束" />
          <input v-model="location" class="loc-input" placeholder="地点" />
        </template>
        <select v-model="seasonId">
          <option value="">无赛季</option>
          <option v-for="s in seasonsStore.seasons" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>

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

      <div class="row tags-row">
        <span v-for="id in tagIds" :key="id" class="tag-chip" :style="{ '--c': tagsStore.byId(id)?.color }">
          {{ tagsStore.byId(id)?.name }}
          <button type="button" class="tag-x" @click="removeTag(id)">✕</button>
        </span>
        <input v-model="tagInput" class="tag-input" placeholder="＋ 标签（回车）" @keyup.enter="addTag" />
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
    </form>

    <section v-for="s in sections" :key="s.type" class="task-section">
      <h3>{{ s.label }}</h3>
      <div v-if="store.byType(s.type).length === 0" class="empty">暂无</div>
      <TaskItem
        v-for="t in store.byType(s.type)"
        :key="t.id"
        :task="t"
        @toggle="store.setStatus(t.id, t.status === 'done' ? 'todo' : 'done')"
        @remove="store.removeTask(t.id)"
        @edit="editing = t"
      />
    </section>

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
</style>
