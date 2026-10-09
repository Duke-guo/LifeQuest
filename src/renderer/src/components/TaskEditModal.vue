<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { useSeasonsStore } from '../stores/seasons'
import { useTagsStore } from '../stores/tags'
import { useConfirmStore } from '../stores/confirm'
import { findConflicts, REPEAT_LABELS, REPEAT_OPTIONS, type Conflict } from '../utils/schedule'
import { toDateStr } from '../utils/helpers'
import AppIcon from './AppIcon.vue'
import OccurrenceEditor from './OccurrenceEditor.vue'
import type { Task, TaskType, TaskKind, RepeatMode, TaskOccurrence } from '../../../shared/types'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ close: [] }>()

const store = useTasksStore()
const confirm = useConfirmStore()
const seasonsStore = useSeasonsStore()
const tagsStore = useTagsStore()

const title = ref(props.task.title)
/** 形式由「有没有填时间段」自动决定：填了就按日程处理 */
const kind = computed<TaskKind>(() => (startTime.value ? 'schedule' : 'task'))
const type = ref<TaskType>(props.task.type)
const importance = ref(props.task.importance)
const due = ref(props.task.due ?? '')
const startTime = ref(props.task.startTime ?? '')
const endTime = ref(props.task.endTime ?? '')
const dueTime = ref(props.task.dueTime ?? '')
const location = ref(props.task.location ?? '')
const remindMinutes = ref(props.task.remindMinutes ?? 0)
const repeat = ref<RepeatMode>(props.task.repeat ?? 'none')
const repeatUntil = ref(props.task.repeatUntil ?? '')
const occurrences = ref<TaskOccurrence[]>([...(props.task.occurrences ?? [])])
const seasonId = ref(props.task.seasonId ?? '')
const description = ref(props.task.description ?? '')
const tagInput = ref('')
const tagIds = ref<string[]>([...(props.task.tagIds ?? [])])

const conflicts = ref<Conflict[]>([])
const saved = ref('')

onMounted(async () => {
  await seasonsStore.load()
  await tagsStore.load()
})

const tagNames = computed(() => tagIds.value.map((id) => tagsStore.byId(id)?.name ?? id))

function candidate(): Task {
  return {
    ...props.task,
    title: title.value,
    kind: kind.value,
    type: type.value,
    importance: importance.value,
    due: due.value || null,
    dueTime: kind.value === 'task' && dueTime.value ? dueTime.value : null,
    startTime: kind.value === 'schedule' ? startTime.value || null : null,
    endTime: kind.value === 'schedule' ? endTime.value || null : null,
    location: location.value.trim() || null,
    repeat: repeat.value,
    repeatUntil: repeat.value !== 'none' && repeatUntil.value ? repeatUntil.value : null,
    occurrences: occurrences.value.filter((o) => o.date)
  }
}

/** 保存前检查与其它日程的时间冲突 */
function checkConflicts(): Conflict[] {
  return findConflicts(store.tasks, candidate())
}

async function save(force = false): Promise<void> {
  if (!force) {
    const found = checkConflicts()
    if (found.length > 0) {
      conflicts.value = found
      return
    }
  }
  const t = store.tasks.find((x) => x.id === props.task.id)
  if (!t) return
  Object.assign(t, candidate())
  t.remindMinutes = remindMinutes.value || null
  t.seasonId = seasonId.value || null
  t.description = description.value
  t.tagIds = [...tagIds.value]
  await store.persist()
  saved.value = '已保存'
  window.setTimeout(() => (saved.value = ''), 1500)
}

async function remove(): Promise<void> {
  const ok = await confirm.ask({
    title: '删除这件事？',
    message: `「${props.task.title}」`,
    detail: '删掉后可以在任务页「历史添加」里一键找回。',
    confirmText: '删除'
  })
  if (!ok) return
  await store.removeTask(props.task.id)
  emit('close')
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
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="edit-card">
      <button class="close" @click="emit('close')"><AppIcon name="close" :size="20" /></button>
      <header class="view-head">
        <div>
          <h2>编辑事项</h2>
          <p class="sub">填了时间段就是「日程」（精确到几点），只填日期就是「任务」（粗略）</p>
        </div>
      </header>

      <label class="field">
        <span>标题</span>
        <input v-model="title" />
      </label>

      <div class="grid">
        <label class="field">
          <span>分类</span>
          <select v-model="type">
            <option value="main">主线</option>
            <option value="side">支线</option>
            <option value="daily">每日</option>
          </select>
        </label>
        <label class="field">
          <span>重要度</span>
          <select v-model.number="importance">
            <option :value="5">5 · 最重要</option>
            <option :value="4">4 · 重要</option>
            <option :value="3">3 · 一般</option>
            <option :value="2">2 · 次要</option>
            <option :value="1">1 · 低</option>
          </select>
        </label>
        <label class="field">
          <span>赛季</span>
          <select v-model="seasonId">
            <option value="">无</option>
            <option v-for="s in seasonsStore.seasons" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
      </div>

      <div class="grid">
        <label class="field">
          <span>{{ kind === 'schedule' ? '日期' : '截止日期' }}</span>
          <input v-model="due" type="date" />
        </label>
        <label class="field">
          <span>开始时间</span>
          <input v-model="startTime" type="time" />
        </label>
        <label class="field">
          <span>结束时间</span>
          <input v-model="endTime" type="time" />
        </label>
        <label v-if="kind === 'task'" class="field" title="留空 = 当天 24:00；日历上会插一面小旗">
          <span>截止时刻</span>
          <input v-model="dueTime" type="time" />
        </label>
        <label class="field">
          <span>地点</span>
          <input v-model="location" placeholder="可选" />
        </label>
        <label class="field">
          <span>提前提醒</span>
          <select v-model.number="remindMinutes">
            <option :value="0">不提醒</option>
            <option :value="5">5 分钟</option>
            <option :value="15">15 分钟</option>
            <option :value="30">30 分钟</option>
            <option :value="60">1 小时</option>
          </select>
        </label>
      </div>
      <p class="kind-hint">
        {{
          kind === 'schedule'
            ? '已填时间段，这条会作为「日程」精确排在日历上。清空开始时间就退回「任务」。'
            : '只填日期就是「任务」（粗略）；填上开始时间会自动变成「日程」，精确到几点到几点。'
        }}
      </p>

      <div class="grid">
        <label class="field">
          <span>重复</span>
          <select v-model="repeat">
            <option v-for="m in REPEAT_OPTIONS" :key="m" :value="m">{{ REPEAT_LABELS[m] }}</option>
          </select>
        </label>
        <label v-if="repeat !== 'none'" class="field">
          <span>重复截止</span>
          <input v-model="repeatUntil" type="date" />
        </label>
      </div>

      <!-- 不规律重复：逐次列日期 -->
      <div class="field occ-block">
        <span>按具体日期（不规律）</span>
        <OccurrenceEditor v-model="occurrences" />
      </div>

      <label class="field">
        <span>详情（可以很长）</span>
        <textarea
          v-model="description"
          class="detail-input"
          rows="4"
          placeholder="要求 / 注意事项 / 链接……"
        ></textarea>
      </label>

      <div class="field tags">
        <span>标签</span>
        <span v-for="id in tagIds" :key="id" class="tag-chip" :style="{ '--c': tagsStore.byId(id)?.color }">
          {{ tagsStore.byId(id)?.name }}
          <button class="tag-x" @click="removeTag(id)">✕</button>
        </span>
        <input v-model="tagInput" class="tag-input" placeholder="＋ 标签（回车）" @keyup.enter="addTag" />
      </div>

      <div v-if="conflicts.length" class="conflict-box">
        <strong>⚠ 时间冲突</strong>
        <ul>
          <li v-for="(c, i) in conflicts" :key="i">
            与「{{ c.b.title }}」（{{ c.b.startTime }}–{{ c.b.endTime }}）重叠
          </li>
        </ul>
        <div class="conflict-actions">
          <button class="ghost" @click="conflicts = []">取消</button>
          <button class="primary" @click="save(true)">仍然保存</button>
        </div>
      </div>

      <div class="actions">
        <button class="danger" @click="remove">删除</button>
        <span v-if="saved" class="ok">{{ saved }}</span>
        <button class="primary save" @click="save()">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 24, 30, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 220;
  padding: 1rem;
}
.edit-card {
  position: relative;
  width: min(600px, 94vw);
  max-height: 90vh;
  overflow-y: auto;
  background: var(--bg);
  border-radius: 20px;
  padding: 1.6rem;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.close {
  position: absolute;
  top: 14px;
  right: 14px;
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}
.close:hover {
  color: var(--text);
}
h2 {
  font-size: 1.35rem;
}
.grid {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.76rem;
  color: var(--text-3);
  flex: 1;
  min-width: 110px;
}
.field input,
.field select {
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.88rem;
}
.field.tags {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
}
.kind-hint {
  margin: -0.3rem 0 0;
  font-size: 0.74rem;
  color: var(--text-3);
  line-height: 1.6;
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
  min-width: 110px;
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
.actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-top: 0.4rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--border);
}
.primary {
  padding: 0.5rem 1.2rem;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}
.save {
  margin-left: auto;
}
.ghost {
  padding: 0.45rem 1rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 10px;
  cursor: pointer;
}
.danger {
  padding: 0.45rem 1rem;
  border: 1px solid var(--danger);
  background: none;
  color: var(--danger);
  border-radius: 10px;
  cursor: pointer;
}
.ok {
  color: var(--success);
  font-size: 0.85rem;
}
</style>
