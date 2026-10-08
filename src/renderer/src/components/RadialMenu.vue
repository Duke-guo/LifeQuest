<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ select: [key: string] }>()

const open = ref(false)
const expanded = ref(false)

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

const RADIUS = 152

const slots = computed(() => {
  const n = items.length
  return items.map((it, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
    return {
      ...it,
      x: Math.round(Math.cos(angle) * RADIUS),
      y: Math.round(Math.sin(angle) * RADIUS),
      delay: i * 40
    }
  })
})

function show(): void {
  open.value = true
  requestAnimationFrame(() => requestAnimationFrame(() => (expanded.value = true)))
}

function hide(): void {
  expanded.value = false
  window.setTimeout(() => (open.value = false), 220)
}

function select(key: string): void {
  emit('select', key)
  hide()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) hide()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <button class="fab" @click="show" title="菜单">
    <AppIcon name="compass" :size="27" />
  </button>

  <transition name="fade">
    <div v-if="open" class="overlay" @click.self="hide">
      <div class="wheel">
        <button
          v-for="s in slots"
          :key="s.key"
          class="radial-item"
          :class="{ expanded }"
          :style="{
            '--x': s.x + 'px',
            '--y': s.y + 'px',
            transitionDelay: expanded ? s.delay + 'ms' : '0ms'
          }"
          @click="select(s.key)"
        >
          <AppIcon :name="s.icon" :size="22" />
          <span class="tip">{{ s.label }}</span>
        </button>

        <button class="wheel-main" @click="hide" title="关闭">
          <AppIcon name="close" :size="26" />
        </button>
      </div>

      <span class="wheel-hint">选择模块 · 点击空白处关闭</span>
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
  background: rgba(16, 18, 24, 0.52);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
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

.wheel {
  position: relative;
  width: 64px;
  height: 64px;
}
.wheel-hint {
  position: fixed;
  left: 50%;
  bottom: 42px;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.84rem;
  letter-spacing: 0.04em;
}

.wheel-main {
  position: absolute;
  inset: 0;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.4);
}

.radial-item {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 58px;
  height: 58px;
  margin: -29px 0 0 -29px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  opacity: 0;
  transform: translate(0, 0) scale(0.2);
  transition:
    transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.25s ease;
}
.radial-item.expanded {
  opacity: 1;
  transform: translate(var(--x), var(--y)) scale(1);
}
.radial-item.expanded:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: translate(var(--x), var(--y)) scale(1.12);
}
.radial-item.expanded:active {
  transform: translate(var(--x), var(--y)) scale(0.94);
}
.tip {
  position: absolute;
  top: calc(100% + 7px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 0.78rem;
  color: var(--text-2);
}
</style>
