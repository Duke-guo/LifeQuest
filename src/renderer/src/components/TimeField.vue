<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

/**
 * 自己画的时间选择器：原生 input[type=time] 的面板改不了样式，
 * 而且它最多只能选到 23:59 —— 选不出「24:00（当天结束）」。
 *  - 时分两列，滚轮/点击都行
 *  - endOfDay = true 时多一个「24:00 当天结束」（结束时间、截止时刻用得上）
 *  - 常用时刻一键填（上课/上班那几档）
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    title?: string
    /** 允许 24:00（= 当天结束） */
    endOfDay?: boolean
    /** 分钟间隔 */
    step?: number
    clearable?: boolean
    disabled?: boolean
  }>(),
  { placeholder: '选择时间', endOfDay: false, step: 5, clearable: true, disabled: false }
)
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const QUICK = ['08:00', '10:00', '12:00', '14:00', '18:00', '20:00', '22:00', '23:00']

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const popRef = ref<HTMLElement | null>(null)
const hourCol = ref<HTMLElement | null>(null)
const minCol = ref<HTMLElement | null>(null)
const pos = ref({ top: '0px', left: '0px' })

const is24 = computed(() => props.modelValue === '24:00')
const curH = computed(() => (is24.value ? 24 : Number((props.modelValue || '').split(':')[0] ?? -1)))
const curM = computed(() => (is24.value ? 0 : Number((props.modelValue || '').split(':')[1] ?? -1)))

const hours = computed(() => {
  const out: string[] = []
  for (let h = 0; h < 24; h++) out.push(String(h).padStart(2, '0'))
  if (props.endOfDay) out.push('24')
  return out
})

/** 分钟列：按 step 走，但如果原来的值不在格点上（比如 18:42），把它也保留下来 */
const minutes = computed(() => {
  const set = new Set<string>()
  for (let m = 0; m < 60; m += props.step) set.add(String(m).padStart(2, '0'))
  if (curM.value >= 0 && curM.value < 60) set.add(String(curM.value).padStart(2, '0'))
  return [...set].sort()
})

const pretty = computed(() => props.modelValue || '')

function label(): string {
  if (!props.modelValue) return ''
  return props.modelValue === '24:00' ? '24:00 · 当天结束' : props.modelValue
}

function place(): void {
  const el = rootRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const W = 252
  const H = 400
  let left = r.left
  if (left + W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - W - 8)
  let top = r.bottom + 6
  if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 6)
  pos.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

function scrollIntoView(): void {
  nextTick(() => {
    hourCol.value
      ?.querySelector<HTMLElement>('.tf-cell.on')
      ?.scrollIntoView({ block: 'center' })
    minCol.value?.querySelector<HTMLElement>('.tf-cell.on')?.scrollIntoView({ block: 'center' })
  })
}

function toggle(): void {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    nextTick(() => {
      place()
      scrollIntoView()
    })
  }
}

/** 只有「分钟」点下去才收起面板：先挑时再挑分，符合手感 */
function setHour(h: string): void {
  if (h === '24') {
    emit('update:modelValue', '24:00')
    open.value = false
    return
  }
  const m = curM.value >= 0 && curM.value < 60 ? String(curM.value).padStart(2, '0') : '00'
  emit('update:modelValue', `${h}:${m}`)
}

function setMinute(m: string): void {
  const h = curH.value === 24 || curH.value < 0 ? '00' : String(curH.value).padStart(2, '0')
  emit('update:modelValue', `${h}:${m}`)
  open.value = false
}

function pick(t: string): void {
  emit('update:modelValue', t)
  open.value = false
}

function clear(): void {
  emit('update:modelValue', '')
  open.value = false
}

function now(): void {
  const d = new Date()
  // 取整到 step（默认 5 分钟）
  const mins = Math.round(d.getMinutes() / props.step) * props.step
  const h = (d.getHours() + Math.floor(mins / 60)) % 24
  const m = mins % 60
  pick(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
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
  <div ref="rootRef" class="tf" :title="title">
    <button type="button" class="tf-btn" :class="{ on: open, empty: !modelValue }" @click="toggle">
      <AppIcon name="clock" :size="15" />
      <span class="tf-text">{{ modelValue ? label() : placeholder }}</span>
      <span v-if="modelValue && clearable" class="tf-x" title="清空" @click.stop="clear">✕</span>
    </button>

    <Teleport to="body">
      <div v-if="open" ref="popRef" class="tf-pop" :style="pos">
        <div class="tf-head">
          <span class="tf-big" :class="{ empty: !modelValue }">{{ modelValue ? pretty : placeholder }}</span>
          <span v-if="is24" class="tf-note">＝当天结束</span>
        </div>

        <div class="tf-colhead">
          <span>时</span>
          <span>分</span>
        </div>
        <div class="tf-cols">
          <div ref="hourCol" class="tf-col">
            <button
              v-for="h in hours"
              :key="h"
              type="button"
              class="tf-cell"
              :class="{ on: String(curH).padStart(2, '0') === h && !is24, end: h === '24' && is24 }"
              @click="setHour(h)"
            >
              {{ h }}
            </button>
          </div>
          <div class="tf-col-sep"></div>
          <div ref="minCol" class="tf-col">
            <button
              v-for="m in minutes"
              :key="m"
              type="button"
              class="tf-cell"
              :class="{ on: String(curM).padStart(2, '0') === m && !is24 }"
              @click="setMinute(m)"
            >
              {{ m }}
            </button>
          </div>
        </div>

        <div v-if="endOfDay" class="tf-24" :class="{ on: is24 }" @click="pick('24:00')">
          24:00 —— 到当天结束（截止时刻 / 上课到半夜常用）
        </div>

        <div class="tf-quick">
          <button v-for="q in QUICK" :key="q" type="button" class="tf-chip" @click="pick(q)">
            {{ q }}
          </button>
        </div>

        <div class="tf-foot">
          <button type="button" class="tf-quick-btn" @click="now">现在</button>
          <span class="tf-spacer"></span>
          <button v-if="clearable" type="button" class="tf-quick-btn" @click="clear">清除</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tf {
  display: inline-block;
  position: relative;
}
.tf-btn {
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
  transition: border-color 0.15s ease;
}
.tf-btn:hover,
.tf-btn.on {
  border-color: var(--accent);
}
.tf-btn.empty {
  color: var(--text-3);
}
.tf-text {
  font-family: var(--font-num);
  white-space: nowrap;
}
.tf-x {
  color: var(--text-3);
  font-size: 0.7rem;
  padding: 0 2px;
}
.tf-x:hover {
  color: var(--danger);
}

/* 面板挂在 body 上（Teleport），scoped 属性还在，样式照样生效 */
.tf-pop {
  position: fixed;
  z-index: 520;
  width: 252px;
  padding: 0.55rem 0.6rem 0.5rem;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  animation: tfIn 0.16s ease-out;
  font-family: var(--font-body);
}
@keyframes tfIn {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
}
.tf-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 0 0.2rem 0.4rem;
}
.tf-big {
  font-family: var(--font-num);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.02em;
}
.tf-big.empty {
  color: var(--text-3);
  font-weight: 400;
  font-size: 1.05rem;
}
.tf-note {
  font-size: 0.72rem;
  color: var(--accent);
}
.tf-colhead {
  display: flex;
  padding: 0 0.25rem 3px;
  font-size: 0.7rem;
  color: var(--text-3);
}
.tf-colhead span {
  flex: 1;
  text-align: center;
}
.tf-cols {
  display: flex;
  height: 208px;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
}
.tf-col {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  padding: 3px;
}
.tf-col-sep {
  width: 1px;
  background: var(--border);
}
.tf-cell {
  display: block;
  width: 100%;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--text-2);
  font-family: var(--font-num);
  font-size: 0.9rem;
  cursor: pointer;
}
.tf-cell:hover {
  background: var(--surface-2);
}
.tf-cell.on {
  background: var(--accent);
  color: #fff;
  font-weight: 700;
}
.tf-cell.end {
  color: var(--accent);
  font-weight: 700;
  font-size: 0.82rem;
}
.tf-24 {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 0.4rem;
  padding: 0.35rem 0.5rem;
  border: 1px dashed var(--border);
  border-radius: 10px;
  font-size: 0.76rem;
  color: var(--text-2);
  cursor: pointer;
}
.tf-24:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.tf-24.on {
  border-style: solid;
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.tf-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 0.45rem;
}
.tf-chip {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 999px;
  padding: 2px 8px;
  font-family: var(--font-num);
  font-size: 0.76rem;
  cursor: pointer;
}
.tf-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.tf-foot {
  display: flex;
  align-items: center;
  margin-top: 0.4rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border);
}
.tf-spacer {
  flex: 1;
}
.tf-quick-btn {
  border: none;
  background: none;
  color: var(--text-2);
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
}
.tf-quick-btn:hover {
  background: var(--accent-soft);
  color: var(--accent);
}
</style>
