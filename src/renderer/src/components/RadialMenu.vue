<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ select: [key: string] }>()

const open = ref(false)
const selected = ref(0)

const items = [
  { key: 'tasks', label: '任务', icon: 'tasks' },
  { key: 'calendar', label: '日历', icon: 'calendar' },
  { key: 'notes', label: '笔记', icon: 'notes' },
  { key: 'journal', label: '日记', icon: 'journal' },
  { key: 'plans', label: '计划', icon: 'plans' },
  { key: 'seasons', label: '赛季', icon: 'seasons' },
  { key: 'graph', label: '知识地图', icon: 'sparkle' },
  { key: 'questmap', label: '主线地图', icon: 'map' }
]

const RADIUS = 165

/** 环形上放「除当前选中之外」的项，随选中项一起旋转 */
const ringItems = computed(() => {
  const others = items
    .map((it, i) => ({ ...it, idx: i }))
    .filter((it) => it.idx !== selected.value)
  const n = others.length
  return others.map((it, i) => {
    const angle = ((i - selected.value) / n) * Math.PI * 2 - Math.PI / 2
    return { ...it, x: Math.round(Math.cos(angle) * RADIUS), y: Math.round(Math.sin(angle) * RADIUS) }
  })
})

const current = computed(() => items[selected.value])

let lock = 0
function cycle(dir: number): void {
  const now = Date.now()
  if (now < lock) return
  lock = now + 110
  selected.value = (selected.value + dir + items.length) % items.length
}

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  if (Math.abs(e.deltaY) < 1) return
  cycle(e.deltaY > 0 ? 1 : -1)
}

function confirm(): void {
  emit('select', current.value.key)
  close()
}

function close(): void {
  open.value = false
}

function onKey(e: KeyboardEvent): void {
  if (!open.value) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') cycle(1)
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') cycle(-1)
  else if (e.key === 'Enter') confirm()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <button class="fab" @click="open = true" title="菜单">
    <AppIcon name="compass" :size="27" />
  </button>

  <transition name="fade">
    <div v-if="open" class="overlay" @click.self="close" @wheel="onWheel">
      <div class="dial">
        <!-- 环形上其它项目（淡化，点它即选中） -->
        <button
          v-for="r in ringItems"
          :key="r.key"
          class="ring-item"
          :title="r.label"
          :style="{ '--x': r.x + 'px', '--y': r.y + 'px' }"
          @click.stop="selected = r.idx"
        >
          <AppIcon :name="r.icon" :size="19" />
        </button>

        <!-- 中心：当前选中项，大图标 + 清晰文字 -->
        <button class="core" @click.stop="confirm">
          <span class="halo"></span>
          <AppIcon :key="current.icon" :name="current.icon" :size="42" class="core-icon" />
          <span class="core-name">{{ current.label }}</span>
        </button>
      </div>

      <span class="hint">滚轮 / ↑↓ 切换 · 点击中心进入 · Esc 关闭</span>
    </div>
  </transition>
</template>

<style scoped>
.fab {
  position: fixed;
  right: 30px;
  bottom: 30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
  z-index: 90;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 14, 13, 0.62);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2.6rem;
  z-index: 150;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.dial {
  position: relative;
  width: 132px;
  height: 132px;
}

/* 环上的其它项目：淡化到几乎隐藏，只作为「还有别的」的提示 */
.ring-item {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 46px;
  height: 46px;
  margin: -23px 0 0 -23px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.22;
  transform: translate(var(--x), var(--y)) scale(0.85);
  transition:
    transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.25s ease,
    color 0.2s ease;
}
.ring-item:hover {
  opacity: 0.95;
  color: var(--accent);
  transform: translate(var(--x), var(--y)) scale(1.12);
}

/* 中心：唯一清晰可见的选中项 */
.core {
  position: absolute;
  inset: 0;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.34);
}
.core:hover {
  filter: brightness(1.06);
}
/* 选中框附近稍稍透明 */
.halo {
  position: absolute;
  inset: -16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.13);
  pointer-events: none;
}
.core-icon {
  animation: popIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.55) rotate(-28deg);
  }
}
.core-name {
  font-family: var(--font-display);
  font-size: 1.15rem;
  letter-spacing: 0.06em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.hint {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.82rem;
  letter-spacing: 0.04em;
}
</style>
