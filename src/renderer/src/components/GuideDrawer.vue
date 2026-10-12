<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ hasDemo?: boolean }>()
const emit = defineEmits<{ openSettings: []; openGuide: []; toggleDemo: [] }>()

const open = ref(false)

function goSettings(): void {
  open.value = false
  emit('openSettings')
}
function goGuide(): void {
  open.value = false
  emit('openGuide')
}
function goDemo(): void {
  open.value = false
  emit('toggleDemo')
}
</script>

<template>
  <div class="guide-root">
    <button class="avatar" :class="{ open }" @click="open = !open" title="菜单 / 新手导引">
      <AppIcon name="compass" :size="24" />
    </button>

    <transition name="drawer">
      <div v-if="open" class="drawer">
        <div class="drawer-brand">LifeQuest</div>
        <button class="drawer-item" @click="goGuide">
          <AppIcon name="guide" :size="19" />
          <span>新手导引</span>
        </button>
        <button class="drawer-item" @click="goDemo">
          <AppIcon name="sparkle" :size="19" />
          <span>{{ props.hasDemo ? '清空示例数据' : '载入示例数据' }}</span>
        </button>
        <button class="drawer-item" @click="goSettings">
          <AppIcon name="settings" :size="19" />
          <span>设置</span>
        </button>
        <button class="drawer-item" disabled title="后续版本">
          <AppIcon name="user" :size="19" />
          <span>用户</span>
          <em class="soon">后续</em>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.guide-root {
  position: fixed;
  left: 22px;
  /* 让开自绘标题栏 */
  top: 54px;
  z-index: 95;
}
.avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  color: var(--accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow);
}
.avatar.open {
  transform: rotate(90deg);
}
.drawer {
  position: absolute;
  top: 54px;
  left: 0;
  min-width: 180px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.drawer-brand {
  font-family: var(--font-display);
  font-size: 1.05rem;
  color: var(--accent);
  padding: 0.3rem 0.6rem 0.5rem;
}
.drawer-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.6rem;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  color: var(--text);
  font-size: 0.92rem;
  text-align: left;
}
.drawer-item:hover {
  background: var(--surface-2);
}
.drawer-item:disabled {
  color: var(--text-3);
  cursor: default;
}
.drawer-item:disabled:hover {
  background: none;
}
.soon {
  margin-left: auto;
  font-style: normal;
  font-size: 0.72rem;
  color: var(--text-3);
  background: var(--surface-2);
  padding: 1px 6px;
  border-radius: 8px;
}
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  transform-origin: top left;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
