<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { toDateStr } from '../utils/helpers'

/**
 * 自己画的日历：原生 input[type=date] 的面板是 Chromium 的，改不了样式。
 *  - 周日开头（和应用的周条一致）
 *  - 点标题切「年 / 月」快速跳，不用一个月一个月翻
 *  - marks 里有事件的日期下面带个小点（比如「这天已经有 3 节课」）
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    title?: string
    /** 允许清空（留空 = 不限） */
    clearable?: boolean
    /** 这些日期下面画个小点 */
    marks?: string[]
    /** 只读展示（比如只用来当按钮标签） */
    disabled?: boolean
  }>(),
  { placeholder: '选择日期', clearable: true, marks: () => [], disabled: false }
)
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const popRef = ref<HTMLElement | null>(null)
const pos = ref({ top: '0px', left: '0px' })
/** 面板里的「当前显示的月份」 */
const viewY = ref(0)
const viewM = ref(0)
/** 'day' | 'month' */
const pane = ref<'day' | 'month'>('day')

const today = toDateStr(new Date())
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const markSet = computed(() => new Set(props.marks))

function parse(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) }
}

const label = computed(() => {
  const p = parse(props.modelValue)
  if (!p) return ''
  return `${p.y} 年 ${p.m + 1} 月 ${p.d} 日`
})
const shortLabel = computed(() => {
  const p = parse(props.modelValue)
  if (!p) return ''
  return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
})
const weekdayOfSel = computed(() => {
  const p = parse(props.modelValue)
  if (!p) return ''
  return `周${WEEK[new Date(p.y, p.m, p.d).getDay()]}`
})

/** 42 格 = 6 周 × 7 天 */
const cells = computed(() => {
  const first = new Date(viewY.value, viewM.value, 1)
  const start = new Date(viewY.value, viewM.value, 1 - first.getDay())
  const out: { iso: string; d: number; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    out.push({ iso: toDateStr(dt), d: dt.getDate(), inMonth: dt.getMonth() === viewM.value })
  }
  return out
})

function syncViewToValue(): void {
  const p = parse(props.modelValue) ?? parse(today)!
  viewY.value = p.y
  viewM.value = p.m
}

function place(): void {
  const el = rootRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const W = 296
  const H = 352
  let left = r.left
  if (left + W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - W - 8)
  let top = r.bottom + 6
  if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 6)
  pos.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

function toggle(): void {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    pane.value = 'day'
    syncViewToValue()
    nextTick(place)
  }
}

function pick(iso: string): void {
  emit('update:modelValue', iso)
  open.value = false
}

function clear(): void {
  emit('update:modelValue', '')
  open.value = false
}

function stepMonth(n: number): void {
  const d = new Date(viewY.value, viewM.value + n, 1)
  viewY.value = d.getFullYear()
  viewM.value = d.getMonth()
}

function pickMonth(m: number): void {
  viewM.value = m
  pane.value = 'day'
}

function onDocDown(e: MouseEvent): void {
  if (!open.value) return
  const t = e.target as Node
  if (rootRef.value?.contains(t) || popRef.value?.contains(t)) return
  open.value = false
}
function onKey(e: KeyboardEvent): void {
  if (open.value && e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    open.value = false
  }
}
function onReflow(): void {
  if (open.value) place()
}

watch(open, (v) => {
  if (v) {
    document.addEventListener('mousedown', onDocDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
  } else {
    document.removeEventListener('mousedown', onDocDown, true)
    document.removeEventListener('keydown', onKey, true)
    window.removeEventListener('resize', onReflow)
    window.removeEventListener('scroll', onReflow, true)
  }
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocDown, true)
  document.removeEventListener('keydown', onKey, true)
  window.removeEventListener('resize', onReflow)
  window.removeEventListener('scroll', onReflow, true)
})
</script>

<template>
  <div ref="rootRef" class="df" :title="title">
    <button type="button" class="df-btn" :class="{ on: open, empty: !modelValue }" @click="toggle">
      <AppIcon name="calendar" :size="15" />
      <span class="df-text">{{ modelValue ? shortLabel : placeholder }}</span>
      <span v-if="modelValue" class="df-wd">{{ weekdayOfSel }}</span>
      <span
        v-if="modelValue && clearable"
        class="df-x"
        title="清空（留空 = 不限）"
        @click.stop="clear"
        >✕</span
      >
    </button>

    <Teleport to="body">
      <div v-if="open" ref="popRef" class="df-pop" :style="pos">
        <div class="df-head">
          <button type="button" class="df-nav" title="上一年" @click="viewY--">«</button>
          <button type="button" class="df-nav" title="上个月" @click="stepMonth(-1)">‹</button>
          <button type="button" class="df-ym" @click="pane = pane === 'day' ? 'month' : 'day'">
            {{ viewY }} 年 {{ viewM + 1 }} 月
            <span class="df-caret">{{ pane === 'day' ? '▾' : '▴' }}</span>
          </button>
          <button type="button" class="df-nav" title="下个月" @click="stepMonth(1)">›</button>
          <button type="button" class="df-nav" title="下一年" @click="viewY++">»</button>
        </div>

        <template v-if="pane === 'day'">
          <div class="df-week">
            <span v-for="w in WEEK" :key="w" :class="{ we: w === '日' || w === '六' }">{{ w }}</span>
          </div>
          <div class="df-grid">
            <button
              v-for="c in cells"
              :key="c.iso"
              type="button"
              class="df-cell"
              :class="{
                other: !c.inMonth,
                today: c.iso === today,
                sel: c.iso === modelValue,
                has: markSet.has(c.iso)
              }"
              @click="pick(c.iso)"
            >
              <span class="df-d">{{ c.d }}</span>
              <i v-if="markSet.has(c.iso)" class="df-dot"></i>
            </button>
          </div>
        </template>

        <div v-else class="df-months">
          <button
            v-for="(m, i) in ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']"
            :key="m"
            type="button"
            class="df-month"
            :class="{ sel: i === viewM }"
            @click="pickMonth(i)"
          >
            {{ m }}
          </button>
        </div>

        <div class="df-foot">
          <button type="button" class="df-quick" @click="pick(today)">今天</button>
          <button
            v-if="modelValue"
            type="button"
            class="df-quick"
            @click="pick(toDateStr(new Date(Date.now() + 86400000)))"
          >
            明天
          </button>
          <span class="df-spacer"></span>
          <button v-if="clearable" type="button" class="df-quick" @click="clear">清除</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.df {
  display: inline-block;
  position: relative;
}
.df-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 34px;
  padding: 0 0.55rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.df-btn:hover,
.df-btn.on {
  border-color: var(--accent);
}
.df-btn.empty {
  color: var(--text-3);
}
.df-text {
  font-family: var(--font-num);
  letter-spacing: 0.01em;
}
.df-wd {
  color: var(--text-3);
  font-size: 0.74rem;
}
.df-x {
  color: var(--text-3);
  font-size: 0.7rem;
  padding: 0 2px;
}
.df-x:hover {
  color: var(--danger);
}

/* 面板用 Teleport 挂到 body 上；Vue 的 scoped 属性仍在这个 DOM 上，所以样式照样生效
   （只是不能再写 .df .df-pop 这种「父级在后」的选择器） */
.df-pop {
  position: fixed;
  z-index: 520;
  width: 296px;
  padding: 0.6rem 0.7rem 0.5rem;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  animation: dfIn 0.16s ease-out;
  font-family: var(--font-body);
}
@keyframes dfIn {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
}
.df-head {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 0.45rem;
}
.df-nav {
  border: none;
  background: none;
  color: var(--text-2);
  font-size: 1rem;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 8px;
  cursor: pointer;
}
.df-nav:hover {
  background: var(--accent-soft);
  color: var(--accent);
}
.df-ym {
  flex: 1;
  border: none;
  background: none;
  color: var(--text);
  font-family: var(--font-display);
  font-size: 0.98rem;
  padding: 3px 6px;
  border-radius: 8px;
  cursor: pointer;
}
.df-ym:hover {
  background: var(--surface-2);
}
.df-caret {
  font-size: 0.7rem;
  color: var(--text-3);
}
.df-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 0.72rem;
  color: var(--text-3);
  text-align: center;
  margin-bottom: 2px;
}
.df-week .we {
  color: var(--accent);
  opacity: 0.65;
}
.df-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.df-cell {
  position: relative;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: none;
  color: var(--text);
  font-family: var(--font-num);
  font-size: 0.86rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.12s ease, color 0.12s ease;
}
.df-cell:hover {
  background: var(--surface-2);
}
.df-cell.other {
  color: var(--text-3);
  opacity: 0.55;
}
.df-cell.today {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 700;
}
.df-cell.sel {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 700;
}
.df-dot {
  position: absolute;
  bottom: 3px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.75;
}
.df-cell.sel .df-dot {
  background: #fff;
}
.df-months {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 2px 0;
}
.df-month {
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-2);
  font-family: var(--font-num);
  font-size: 0.85rem;
  cursor: pointer;
}
.df-month:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.df-month.sel {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.df-foot {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 0.45rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--border);
}
.df-spacer {
  flex: 1;
}
.df-quick {
  border: none;
  background: none;
  color: var(--text-2);
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
}
.df-quick:hover {
  background: var(--accent-soft);
  color: var(--accent);
}
</style>
