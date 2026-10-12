<script setup lang="ts">
import { ref, computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ hasDemo?: boolean }>()
const emit = defineEmits<{ close: []; demo: [] }>()

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
    body: '点右下角罗盘，6 个模块像水滴一样分裂出来：任务、日历、日记、笔记、计划、赛季。每个页面右上角都有一个「?」，点了就是本页说明。'
  },
  {
    icon: 'tasks',
    title: '任务与重复',
    body: '任务分主线 / 支线 / 每日；重复方式有每天 / 工作日 / 每周 / 每两周 / 每 N 天 / 每月。\n点任务卡上的日历按钮能列出它的所有日期：只勾某一天、跳到那一周，或者「删掉这一次」（放假 / 调课）。\n只有截止日期的任务（ddl）会每天自动冒头，越接近截止越醒目。'
  },
  {
    icon: 'calendar',
    title: '日历',
    body: '月 / 周 / 日三种视图。周视图每天自动配色（色相＝忙碌、饱和度＝心情、明度＝天气）；\n学期计划里设的「停课日」会自动消失；结束时间可以选 24:00（当天结束）；有 5 星任务的那天会算「紧张」。'
  },
  {
    icon: 'notes',
    title: '日记 · 笔记 · 知识地图',
    body: '日记每天几行，日历和主线地图上会长出蓝点；笔记支持 Markdown / 图片 / 附件，打标签、关联到任务之后，「知识地图」会把它们织成一张网。'
  },
  {
    icon: 'sparkle',
    title: '赛季 · 成就 · 回顾',
    body: '「赛季」是内容节奏：主线地图上主轴是学期、支线是假期；你会得到称号和里程碑成就，也能自己定目标；点赛季里的「生成回顾」，直接在应用里看这一季的统计、高光时刻、你写过的原话。'
  },
  {
    icon: 'journal',
    title: '数据属于你',
    body: '所有数据都是本机文件夹里普通的 Markdown / JSON 文件，程序外也能打开、改、备份。\n第一次用的话，可以先载入一份「示例数据」看看每个页面长什么样——随时可以一键清空，不碰你自己的东西。'
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
      <p class="body">{{ current.body }}</p>

      <div v-if="step === total - 1" class="demo-row">
        <button class="demo" @click="emit('demo')">
          <AppIcon name="sparkle" :size="15" />
          {{ props.hasDemo ? '清空示例数据' : '载入一份示例数据' }}
        </button>
        <span class="demo-hint">示例数据都带「示例」前缀，可随时清空</span>
      </div>

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
  width: min(480px, 90vw);
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
.body {
  color: var(--text-2);
  line-height: 1.75;
  margin: 0;
  min-height: 54px;
  white-space: pre-line;
  font-size: 0.92rem;
}
.demo-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 0.9rem;
}
.demo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0.4rem 1rem;
  border: 2px dashed var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 12px;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 0.9rem;
}
.demo:hover {
  border-style: solid;
}
.demo-hint {
  font-size: 0.72rem;
  color: var(--text-3);
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
