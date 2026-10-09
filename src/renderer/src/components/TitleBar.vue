<script setup lang="ts">
import { ref, onMounted } from 'vue'

const maximized = ref(false)

onMounted(async () => {
  try {
    maximized.value = await window.api.win.isMaximized()
    window.api.win.onMaximizedChange((v) => (maximized.value = v))
  } catch {
    // 浏览器预览环境没有 window.api，忽略
  }
})

// 模板里不能直接写 window（会被当成组件属性），统一包成方法
function minimize(): void {
  void window.api.win.minimize()
}
async function toggleMaximize(): Promise<void> {
  maximized.value = await window.api.win.toggleMaximize()
}
function closeWindow(): void {
  void window.api.win.close()
}
</script>

<template>
  <div class="titlebar">
    <span class="brand">LifeQuest</span>
    <span class="spacer"></span>

    <div class="win-btns">
      <button class="wb wb-min" title="最小化" @click="minimize">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3 8.5h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
        </svg>
      </button>

      <button class="wb wb-max" :title="maximized ? '还原' : '最大化'" @click="toggleMaximize">
        <svg v-if="!maximized" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect
            x="3.6"
            y="3.6"
            width="8.8"
            height="8.8"
            rx="2"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
          />
        </svg>
        <svg v-else viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect x="3.4" y="5.8" width="6.8" height="6.8" rx="1.8" stroke="currentColor" stroke-width="1.8" fill="none" />
          <path d="M6.2 4.2h5.2a1.6 1.6 0 0 1 1.6 1.6v5.2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" />
        </svg>
      </button>

      <button class="wb wb-close" title="关闭" @click="closeWindow">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 38px;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 6px 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  /* 整条可拖动窗口 */
  -webkit-app-region: drag;
  user-select: none;
}
.brand {
  font-family: var(--font-display);
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  color: var(--accent);
  opacity: 0.85;
}
.spacer {
  flex: 1;
}
.win-btns {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}
.wb {
  width: 30px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  box-shadow: 0 2px 0 var(--surface-2);
  transition:
    transform 0.13s ease,
    box-shadow 0.13s ease,
    border-color 0.13s ease,
    color 0.13s ease,
    background-color 0.13s ease;
}
.wb:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
  color: var(--accent);
}
.wb:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: 0 0 0 var(--surface-2);
}
.wb-close:hover {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}
</style>
