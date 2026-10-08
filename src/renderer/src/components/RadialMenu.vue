<script setup lang="ts">
import { ref, computed } from 'vue'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ select: [key: string] }>()

const open = ref(false)

const items = [
  { key: 'tasks', label: '任务', icon: 'tasks' },
  { key: 'calendar', label: '日历', icon: 'calendar' },
  { key: 'notes', label: '笔记', icon: 'notes' },
  { key: 'journal', label: '日记', icon: 'journal' },
  { key: 'plans', label: '计划', icon: 'plans' },
  { key: 'seasons', label: '赛季', icon: 'seasons' }
]

const RADIUS = 116

const slots = computed(() => {
  const n = items.length
  return items.map((it, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
    return {
      ...it,
      x: Math.round(Math.cos(angle) * RADIUS),
      y: Math.round(Math.sin(angle) * RADIUS),
      delay: i * 22
    }
  })
})

function select(key: string): void {
  emit('select', key)
  open.value = false
}
</script>

<template>
  <div class="radial-root">
    <transition name="label">
      <span v-if="open" class="hint">选择模块</span>
    </transition>

    <button
      v-for="s in slots"
      :key="s.key"
      class="radial-item"
      :class="{ open }"
      :style="{ '--x': s.x + 'px', '--y': s.y + 'px', transitionDelay: open ? s.delay + 'ms' : '40ms' }"
      :title="s.label"
      @click="select(s.key)"
    >
      <AppIcon :name="s.icon" />
      <span class="tip">{{ s.label }}</span>
    </button>

    <button class="radial-main" :class="{ open }" @click="open = !open" title="菜单">
      <AppIcon name="compass" :size="27" />
    </button>
  </div>
</template>

<style scoped>
.radial-root {
  position: fixed;
  right: 30px;
  bottom: 30px;
  width: 60px;
  height: 60px;
  z-index: 90;
}
.hint {
  position: absolute;
  bottom: 66px;
  right: 0;
  white-space: nowrap;
  color: var(--text-2);
  font-size: 0.8rem;
  background: var(--surface);
  padding: 3px 10px;
  border-radius: 12px;
  box-shadow: var(--shadow);
}
.radial-main {
  position: absolute;
  inset: 0;
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
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.radial-main.open {
  transform: rotate(135deg);
}
.radial-item {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 48px;
  height: 48px;
  margin: -24px 0 0 -24px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow);
  opacity: 0;
  pointer-events: none;
  transform: translate(0, 0) scale(0.2);
  transition: transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease;
}
.radial-item .tip {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  right: calc(100% + 8px);
  white-space: nowrap;
  font-size: 0.78rem;
  background: var(--surface);
  color: var(--text-2);
  padding: 2px 8px;
  border-radius: 10px;
  box-shadow: var(--shadow);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.radial-item:hover .tip {
  opacity: 1;
}
.radial-item.open {
  opacity: 1;
  pointer-events: auto;
  transform: translate(var(--x), var(--y)) scale(1);
}
.radial-item.open:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: translate(var(--x), var(--y)) scale(1.1);
}
.radial-item.open:active {
  transform: translate(var(--x), var(--y)) scale(0.92);
}
.label-enter-active,
.label-leave-active {
  transition: opacity 0.2s ease;
}
.label-enter-from,
.label-leave-to {
  opacity: 0;
}
</style>
