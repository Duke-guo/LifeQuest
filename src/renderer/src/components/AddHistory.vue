<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useHistoryStore } from '../stores/history'
import { useTasksStore } from '../stores/tasks'
import { useConfirmStore } from '../stores/confirm'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ compact?: boolean }>()

const history = useHistoryStore()
const tasks = useTasksStore()
const confirm = useConfirmStore()
const open = ref(false)
const hint = ref('')

/** 清空历史：会把「一键找回」的底稿一起删掉，先确认 */
async function clearHistory(): Promise<void> {
  const ok = await confirm.ask({
    title: '清空添加历史？',
    message: `共 ${history.entries.length} 条记录`,
    detail: '清空后误删的内容就不能再一键找回了。',
    confirmText: '清空'
  })
  if (ok) await history.clear()
}

onMounted(async () => {
  if (!history.loaded) await history.load()
})

const list = computed(() => (props.compact ? history.entries.slice(0, 6) : history.entries.slice(0, 14)))
const deletedCount = computed(() => history.deleted.length)

async function restore(id: string): Promise<void> {
  const e = history.entries.find((x) => x.id === id)
  if (!e) return
  await tasks.restoreTask(e.task)
  hint.value = `已重新添加「${e.task.title}」`
  window.setTimeout(() => (hint.value = ''), 2000)
}

function fmt(at: string): string {
  const d = new Date(at)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="hist">
    <button class="hist-head" @click="open = !open">
      <AppIcon name="plans" :size="15" />
      <span class="hist-title">历史添加</span>
      <span v-if="deletedCount" class="hist-badge">{{ deletedCount }} 项已删除</span>
      <span class="hist-sub">误删可一键找回</span>
      <span class="caret">{{ open ? '▾' : '▸' }}</span>
    </button>

    <div v-if="open" class="hist-body">
      <div v-if="history.entries.length === 0" class="hist-none">还没有记录</div>
      <template v-else>
        <div v-for="e in list" :key="e.id" class="hist-row">
          <span class="hist-tag" :class="e.action">{{ e.action === 'delete' ? '已删除' : '已添加' }}</span>
          <span class="hist-name">{{ e.task.title }}</span>
          <span class="hist-meta">
            {{ e.task.due ?? '无日期' }}
            <template v-if="e.task.startTime"> · {{ e.task.startTime }}<template v-if="e.task.endTime">–{{ e.task.endTime }}</template></template>
          </span>
          <span class="hist-time">{{ fmt(e.at) }}</span>
          <button class="hist-btn" @click="restore(e.id)">重新添加</button>
        </div>
        <div class="hist-foot">
          <span v-if="hint" class="hist-ok">{{ hint }}</span>
          <button class="hist-clear" @click="clearHistory">清空历史</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hist {
  margin-top: 0.6rem;
}
.hist-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  border: 1px dashed var(--border);
  background: none;
  border-radius: 9px;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
  color: var(--text-2);
  font-size: 0.82rem;
}
.hist-head:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.hist-title {
  font-weight: 600;
}
.hist-badge {
  background: rgba(217, 80, 80, 0.14);
  color: var(--danger);
  border-radius: 6px;
  padding: 0 6px;
  font-size: 0.72rem;
}
.hist-sub {
  color: var(--text-3);
  font-size: 0.74rem;
}
.caret {
  margin-left: auto;
  color: var(--text-3);
}
.hist-body {
  margin-top: 0.4rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.5rem 0.6rem;
  background: var(--surface);
}
.hist-none {
  font-size: 0.8rem;
  color: var(--text-3);
}
.hist-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.22rem 0;
  font-size: 0.8rem;
  border-bottom: 1px dashed var(--border);
}
.hist-row:last-of-type {
  border-bottom: none;
}
.hist-tag {
  flex-shrink: 0;
  font-size: 0.68rem;
  border-radius: 5px;
  padding: 0 5px;
}
.hist-tag.delete {
  background: rgba(217, 80, 80, 0.14);
  color: var(--danger);
}
.hist-tag.add {
  background: rgba(85, 168, 159, 0.16);
  color: #3d827a;
}
.hist-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
.hist-meta,
.hist-time {
  color: var(--text-3);
  font-size: 0.74rem;
  white-space: nowrap;
}
.hist-time {
  margin-left: auto;
}
.hist-btn {
  flex-shrink: 0;
  border: 1px solid var(--accent);
  background: none;
  color: var(--accent);
  border-radius: 7px;
  padding: 0.15rem 0.5rem;
  font-size: 0.74rem;
  cursor: pointer;
}
.hist-btn:hover {
  background: var(--accent);
  color: #fff;
}
.hist-foot {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.45rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--border);
}
.hist-ok {
  color: var(--success);
  font-size: 0.78rem;
}
.hist-clear {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--text-3);
  font-size: 0.74rem;
  cursor: pointer;
}
.hist-clear:hover {
  color: var(--danger);
}
</style>
