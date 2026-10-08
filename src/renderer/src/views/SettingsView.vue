<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { dataApi } from '../services/data'
import { applyTheme, type Theme } from '../utils/theme'
import AppIcon from '../components/AppIcon.vue'

const emit = defineEmits<{ close: [] }>()

const store = useSettingsStore()
const dataRoot = ref('')
const exportMsg = ref('')

onMounted(async () => {
  await store.load()
  dataRoot.value = await dataApi.getRoot()
})

async function setTheme(theme: Theme): Promise<void> {
  if (!store.settings) return
  store.settings.theme = theme
  applyTheme(theme)
  await store.save()
}

async function toggleAnimations(): Promise<void> {
  if (!store.settings) return
  store.settings.animations.enabled = !store.settings.animations.enabled
  await store.save()
}

async function toggleGamification(): Promise<void> {
  if (!store.settings) return
  store.settings.gamification.enabled = !store.settings.gamification.enabled
  await store.save()
}

async function doExport(): Promise<void> {
  const res = await dataApi.export()
  exportMsg.value = res.canceled ? '已取消' : `导出成功：${res.dest}`
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="settings-card">
      <button class="close" @click="emit('close')"><AppIcon name="close" :size="20" /></button>
      <header class="view-head">
        <div>
          <h2>设置</h2>
          <p class="sub">本地优先 · 数据属于你</p>
        </div>
      </header>

      <section class="card">
        <h3>外观</h3>
        <div class="theme-row">
          <button class="theme-opt" :class="{ on: store.settings?.theme !== 'dark' }" @click="setTheme('light')">
            明亮
          </button>
          <button class="theme-opt" :class="{ on: store.settings?.theme === 'dark' }" @click="setTheme('dark')">
            暗色
          </button>
        </div>
      </section>

      <section class="card">
        <h3>数据</h3>
        <p class="row">数据位置：<code>{{ dataRoot }}</code></p>
        <p class="row hint">数据即普通文件（Markdown + JSON），可随时复制、备份、迁移。</p>
        <button class="btn" @click="doExport">导出数据（复制到指定文件夹）</button>
        <p v-if="exportMsg" class="msg">{{ exportMsg }}</p>
      </section>

      <section class="card">
        <h3>游戏化（轻 · 不焦虑）</h3>
        <label class="toggle">
          <input
            type="checkbox"
            :checked="store.settings?.gamification.enabled ?? true"
            @change="toggleGamification"
          />
          显示游戏化元素（成就 / 成长）
        </label>
        <label class="toggle">
          <input
            type="checkbox"
            :checked="store.settings?.animations.enabled ?? true"
            @change="toggleAnimations"
          />
          动画效果
        </label>
        <p class="hint">无排行榜、无连续打卡惩罚、无强制任务。</p>
      </section>
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
  z-index: 200;
  padding: 1rem;
}
.settings-card {
  position: relative;
  width: min(520px, 92vw);
  max-height: 88vh;
  overflow-y: auto;
  background: var(--bg);
  border-radius: 20px;
  padding: 1.75rem;
  box-shadow: var(--shadow-lg);
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
h3 {
  margin-bottom: 0.7rem;
  font-size: 1.05rem;
}
.theme-row {
  display: flex;
  gap: 0.5rem;
}
.theme-opt {
  padding: 0.5rem 1.4rem;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-2);
  font-weight: 600;
}
.theme-opt.on {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.row {
  margin: 0.4rem 0;
  word-break: break-all;
}
.btn {
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  margin-top: 0.5rem;
}
.msg {
  color: var(--success);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  cursor: pointer;
}
.hint {
  color: var(--text-3);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}
</style>
