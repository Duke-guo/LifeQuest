<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { dataApi } from '../services/data'

const store = useSettingsStore()
const dataRoot = ref('')
const exportMsg = ref('')

onMounted(async () => {
  await store.load()
  dataRoot.value = await dataApi.getRoot()
})

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
  <div class="settings-view">
    <header class="view-head">
      <div>
        <h2>设置</h2>
        <p class="sub">本地优先 · 数据属于你</p>
      </div>
    </header>

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
</template>

<style scoped>
h3 {
  margin-bottom: 0.75rem;
}
.row {
  margin: 0.4rem 0;
}
code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-all;
}
.btn {
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  margin-top: 0.5rem;
}
.msg {
  color: #16a34a;
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
  color: #999;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}
</style>
