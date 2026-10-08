<script setup lang="ts">
import { ref, computed } from 'vue'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ close: [] }>()

const step = ref(0)

const steps = [
  {
    icon: 'compass',
    title: '欢迎来到 LifeQuest',
    body: '一个用游戏化方式管理现实生活的应用，但不制造焦虑——没有排行榜、没有连续打卡惩罚、没有强制任务。'
  },
  {
    icon: 'tasks',
    title: '右下角 · 召唤导航',
    body: '点击右下角的罗盘按钮，6 个模块会像水滴一样分裂出来，点图标进入对应功能。'
  },
  {
    icon: 'journal',
    title: '左上角 · 这里常驻',
    body: '左上角图标随时可打开：新手导引、设置，以及后续的用户相关内容，都从这里进入。'
  },
  {
    icon: 'notes',
    title: '数据属于你',
    body: '所有数据都是 D 盘工作区里普通的 Markdown / JSON 文件，程序外也能打开、复制、备份。'
  }
]

const total = computed(() => steps.length)
const current = computed(() => steps[step.value])

function next(): void {
  if (step.value < total.value - 1) step.value++
  else emit('close')
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="guide-card">
      <button class="close" @click="emit('close')"><AppIcon name="close" :size="20" /></button>
      <div class="guide-icon"><AppIcon :name="current.icon" :size="34" /></div>
      <h2>{{ current.title }}</h2>
      <p>{{ current.body }}</p>
      <div class="footer">
        <div class="dots">
          <span v-for="(s, i) in steps" :key="i" class="dot" :class="{ on: i === step }"></span>
        </div>
        <button class="next" @click="next">{{ step < total - 1 ? '下一步' : '开始使用' }}</button>
      </div>
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
  animation: fade 0.2s ease;
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
.guide-card {
  position: relative;
  width: min(440px, 88vw);
  background: var(--surface);
  border-radius: 20px;
  padding: 2rem 2rem 1.5rem;
  box-shadow: var(--shadow-lg);
  text-align: center;
  animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
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
.guide-icon {
  width: 66px;
  height: 66px;
  margin: 0 auto 0.75rem;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.guide-card h2 {
  margin: 0 0 0.75rem;
  color: var(--accent);
}
.guide-card p {
  color: var(--text-2);
  line-height: 1.7;
  margin: 0;
  min-height: 54px;
}
.footer {
  margin-top: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dots {
  display: flex;
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
}
.dot.on {
  background: var(--accent);
  width: 20px;
  border-radius: 5px;
}
.next {
  padding: 0.5rem 1.4rem;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}
</style>
