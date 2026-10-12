<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Task } from '../../../shared/types'
import { allOccurrences, isDoneOn, isRepeating, skipReason } from '../utils/schedule'
import { useTasksStore } from '../stores/tasks'
import { useSemesterStore } from '../stores/semester'
import { useConfirmStore } from '../stores/confirm'
import { todayStr } from '../utils/helpers'
import AppIcon from './AppIcon.vue'

/**
 * 「这件事都会在哪几天出现」——点任务卡上的日历按钮弹出来。
 * 每行可以：勾掉/取消那一天、删掉这一次（放假/调课，带确认框）、点「去日历」跳到那一周。
 */
const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ close: []; locate: [date: string] }>()

const store = useTasksStore()
const semesterStore = useSemesterStore()
const confirm = useConfirmStore()
const today = todayStr()
const listRef = ref<HTMLElement | null>(null)

/** 用 store 里的活对象，勾选后状态立刻跟着变 */
const live = computed<Task>(() => store.tasks.find((t) => t.id === props.task.id) ?? props.task)

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `周${WEEKDAY[new Date(y, m - 1, d).getDay()]}`
}

interface Row {
  date: string
  done: boolean
  isToday: boolean
  /** 最近一次「还没到的」（今天或以后） */
  isNext: boolean
  past: boolean
  /** 这一次不算数：自己排掉的（放假 / 调课） */
  skipped: boolean
  /** 这一次不算数：校历里写着停课 */
  holiday: boolean
}

const rows = computed<Row[]>(() => {
  // includeSkipped：排掉的和停课的那几次仍要列出来（划掉 / 标停课），否则用户没法反悔
  const dates = allOccurrences(live.value, {
    cap: 400,
    includeSkipped: true,
    holidaySkips: semesterStore.noClassDates
  })
  const off = (d: string): 'own' | 'holiday' | null =>
    skipReason(live.value, d, semesterStore.noClassDates)
  // 单次任务也走同一套：allOccurrences 会把它自己那一天返回
  const next = dates.find((d) => d >= today && !off(d) && !isDoneOn(live.value, d)) ?? null
  return dates.map((d) => {
    const why = off(d)
    return {
      date: d,
      done: isDoneOn(live.value, d),
      isToday: d === today,
      isNext: d === next,
      past: d < today,
      skipped: why === 'own',
      holiday: why === 'holiday'
    }
  })
})

const doneCount = computed(() => rows.value.filter((r) => r.done && !r.skipped && !r.holiday).length)
const skipCount = computed(() => rows.value.filter((r) => r.skipped).length)
const holidayCount = computed(() => rows.value.filter((r) => r.holiday).length)
/** 真的会发生的次数（排掉的和校历停课的不算） */
const liveCount = computed(() => rows.value.filter((r) => !r.skipped && !r.holiday).length)

/** 这是最后一条「已经过去的」，在它后面画一条分界线 */
function pastEnd(i: number): boolean {
  const list = rows.value
  return list[i].past && (i === list.length - 1 || !list[i + 1].past)
}

async function toggle(date: string): Promise<void> {
  await store.toggleDone(live.value.id, date)
}

/** 删掉这一次：先问一句，防误触 */
async function dropOnce(date: string): Promise<void> {
  const ok = await confirm.ask({
    title: '删掉这一次？',
    message: `${live.value.title} · ${date}（${weekday(date)}）`,
    detail:
      '只影响这一次：日历上不再出现、进度里也不算它。这件事本身和其它次数都不动，之后在同一条上点「恢复」就能找回来。',
    confirmText: '删掉这一次',
    cancelText: '算了'
  })
  if (ok) await store.skipOccurrence(live.value.id, date)
}

async function restore(date: string): Promise<void> {
  await store.unskipOccurrence(live.value.id, date)
}

function go(date: string): void {
  emit('locate', date)
  emit('close')
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  // 过去可能有几十次，打开时直接把「今天 / 下次」那一行滚到眼前
  requestAnimationFrame(() => {
    const list = listRef.value
    const target = list?.querySelector<HTMLElement>('.oc-row.today, .oc-row.next')
    if (!list || !target) return
    const delta = target.getBoundingClientRect().top - list.getBoundingClientRect().top
    list.scrollTop += delta - Math.min(64, list.clientHeight / 3)
  })
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <!-- 挂到 body：任务卡的 .quest 带 filter: drop-shadow，会让 position: fixed 认它当参照物，
       弹窗就会被卡片裁掉、遮罩也铺不满窗口 -->
  <Teleport to="body">
    <transition name="oc">
      <div class="oc-mask" @click.self="emit('close')">
        <div class="oc-box" role="dialog" aria-modal="true">
          <header class="oc-head">
            <div class="oc-title">
              <span class="oc-name">{{ live.title }}</span>
              <span class="oc-sub">
                {{ isRepeating(live) ? `共 ${liveCount} 次` : '单次' }} · 已完成 {{ doneCount }}
                <template v-if="skipCount"> · 已排掉 {{ skipCount }} 次</template>
                <template v-if="holidayCount"> · 校历停课 {{ holidayCount }} 次</template>
                <template v-if="live.location"> · {{ live.location }}</template>
              </span>
            </div>
            <button class="oc-x" title="关闭" @click="emit('close')"><AppIcon name="close" :size="18" /></button>
          </header>

          <p class="oc-tip">
            圆圈 = 勾掉<b>那一天</b>（不影响别的天）；<b>去日历</b>跳到那一周；
            <b>垃圾桶</b>= 这一天不上（放假 / 调课），会先问你一句。
            <template v-if="holidayCount">
              <br />带「停课」的是<b>学期计划</b>里的放假，日历上本来就不会出现。
            </template>
          </p>

          <div ref="listRef" class="oc-list">
            <template v-for="(r, i) in rows" :key="r.date">
              <div
                class="oc-row"
                :class="{
                  done: r.done && !r.skipped && !r.holiday,
                  today: r.isToday && !r.skipped && !r.holiday,
                  next: r.isNext && !r.isToday && !r.skipped && !r.holiday,
                  past: r.past,
                  skipped: r.skipped || r.holiday
                }"
              >
                <button
                  v-if="!r.skipped && !r.holiday"
                  class="oc-check"
                  :title="r.done ? '取消这一天的完成' : '把这一天标成完成'"
                  @click="toggle(r.date)"
                >
                  {{ r.done ? '✓' : '' }}
                </button>
                <span v-else class="oc-check off" :title="r.holiday ? '校历里这天停课' : '这一次已排掉'">–</span>
                <span class="oc-date">{{ r.date }}</span>
                <span class="oc-wd">{{ weekday(r.date) }}</span>
                <span v-if="r.holiday" class="oc-badge holiday-badge" title="学期计划里写了这天放假停课">停课</span>
                <span v-else-if="r.skipped" class="oc-badge skip-badge">已排掉</span>
                <span v-else-if="r.isToday" class="oc-badge today-badge">今天</span>
                <span v-else-if="r.isNext" class="oc-badge next-badge">下次</span>

                <template v-if="r.holiday">
                  <span class="oc-note">校历停课 · 要改去「计划 → 学期计划」</span>
                </template>
                <template v-else-if="r.skipped">
                  <button class="oc-go" @click="restore(r.date)">
                    <AppIcon name="refresh" :size="14" /> 恢复
                  </button>
                </template>
                <template v-else>
                  <button class="oc-go" @click="go(r.date)">
                    <AppIcon name="calendar" :size="14" /> 去日历
                  </button>
                  <button
                    v-if="isRepeating(live)"
                    class="oc-drop"
                    title="这一次不上（放假 / 调课）——会先问你一句"
                    @click="dropOnce(r.date)"
                  >
                    <AppIcon name="trash" :size="14" />
                  </button>
                </template>
              </div>
              <div v-if="pastEnd(i)" class="oc-split">
                <span>以上是过去的 {{ i + 1 }} 次</span>
              </div>
            </template>
            <div v-if="rows.length === 0" class="oc-none">这件事还没有日期</div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.oc-mask {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(20, 14, 13, 0.45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.oc-box {
  width: min(520px, 100%);
  max-height: min(76vh, 640px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 18px;
  padding: 1.1rem 1.2rem 1rem;
  box-shadow: var(--shadow-lg);
  animation: ocIn 0.22s cubic-bezier(0.34, 1.4, 0.64, 1);
}
@keyframes ocIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.97);
  }
}
.oc-head {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}
.oc-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.oc-name {
  font-family: var(--font-display);
  font-size: 1.12rem;
}
.oc-sub {
  font-size: 0.76rem;
  color: var(--text-3);
}
.oc-x {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  padding: 2px;
}
.oc-x:hover {
  color: var(--accent);
}
.oc-tip {
  margin: 0.5rem 0 0.7rem;
  font-size: 0.78rem;
  color: var(--text-3);
  line-height: 1.65;
}
.oc-list {
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 2px;
}
.oc-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.4rem;
  border-radius: 10px;
  border: 1px solid transparent;
}
.oc-row:hover {
  background: var(--surface-2);
}
/* 今天 / 下次：一眼能找到 */
.oc-row.today {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.oc-row.next {
  border-color: var(--border);
  background: rgba(217, 156, 43, 0.1);
}
.oc-row.past:not(.done) .oc-date {
  color: var(--text-3);
}
.oc-row.done .oc-date {
  text-decoration: line-through;
  color: var(--text-3);
}
/* 排掉的那一次：整行压暗 + 划掉，但仍留在列表里（可恢复） */
.oc-row.skipped {
  opacity: 0.62;
}
.oc-row.skipped .oc-date,
.oc-row.skipped .oc-wd {
  text-decoration: line-through;
  color: var(--text-3);
}
.oc-check.off {
  border-style: dashed;
  color: var(--text-3);
  cursor: default;
}
.oc-check {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: none;
  color: #fff;
  font-size: 0.74rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.oc-row.done .oc-check {
  background: var(--success);
  border-color: var(--success);
}
.oc-check:hover {
  border-color: var(--accent);
}
.oc-date {
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 0.92rem;
}
.oc-wd {
  font-size: 0.78rem;
  color: var(--text-3);
}
.oc-badge {
  font-size: 0.68rem;
  border-radius: 999px;
  padding: 1px 8px;
}
.today-badge {
  background: var(--accent);
  color: #fff;
}
.next-badge {
  background: rgba(217, 156, 43, 0.28);
  color: #8a5e0c;
}
.miss-badge {
  background: var(--surface-2);
  color: var(--text-3);
}
.skip-badge {
  background: var(--surface-2);
  color: var(--text-3);
  border: 1px dashed var(--border);
}
/* 校历停课：和「自己排掉的」区分开 */
.holiday-badge {
  background: rgba(91, 141, 239, 0.16);
  color: #3f6fd0;
}
.oc-note {
  margin-left: auto;
  font-size: 0.72rem;
  color: var(--text-3);
}
/* 过去 / 以后 的分界：一条细线，比每行挂个「已过」干净 */
.oc-split {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 2px;
  font-size: 0.72rem;
  color: var(--text-3);
}
.oc-split::before,
.oc-split::after {
  content: '';
  height: 1px;
  background: var(--border);
  flex: 1;
}
.oc-go {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 0.78rem;
  cursor: pointer;
}
.oc-go:hover {
  border-color: var(--accent);
  color: var(--accent);
}
/* 删掉这一次：平时很安静，鼠标上来才变红 */
.oc-drop {
  display: inline-flex;
  align-items: center;
  border: 1px solid transparent;
  background: none;
  color: var(--text-3);
  border-radius: 999px;
  padding: 3px 7px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.oc-row:hover .oc-drop {
  opacity: 1;
}
.oc-drop:hover {
  color: var(--danger);
  border-color: var(--danger);
}
.oc-none {
  padding: 1rem 0.4rem;
  color: var(--text-3);
  font-size: 0.85rem;
}
.oc-enter-active,
.oc-leave-active {
  transition: opacity 0.18s ease;
}
.oc-enter-from,
.oc-leave-to {
  opacity: 0;
}
</style>
