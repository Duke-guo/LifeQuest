<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { toDateStr } from '../utils/helpers'
import AppIcon from './AppIcon.vue'

const store = useTasksStore()
const now = ref(new Date())
const dismissed = ref<string[]>([])
let timer: number | undefined

/** 响应式：store.tasks 加载完成或时间推进时都会重算 */
const due = computed(() => {
  const today = toDateStr(now.value)
  const nowMin = now.value.getHours() * 60 + now.value.getMinutes()
  return store.tasks.filter((t) => {
    if (t.kind !== 'schedule' || t.due !== today) return false
    if (t.status === 'done' || t.status === 'archived') return false
    if (!t.startTime || dismissed.value.includes(t.id)) return false
    const [h, m] = t.startTime.split(':').map(Number)
    const startMin = h * 60 + (m || 0)
    const ahead = t.remindMinutes ?? 15
    const diff = startMin - nowMin
    return diff <= ahead && diff >= -2
  })
})

function dismiss(id: string): void {
  dismissed.value = [...dismissed.value, id]
}

onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 30000)
})
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <transition name="slide">
    <div v-if="due.length" class="reminders">
      <div v-for="t in due" :key="t.id" class="reminder">
        <span class="bell"><AppIcon name="calendar" :size="16" /></span>
        <span class="text">
          即将开始：<strong>{{ t.title }}</strong>
          <em>{{ t.startTime }}<template v-if="t.location"> · {{ t.location }}</template></em>
        </span>
        <button class="x" @click="dismiss(t.id)"><AppIcon name="close" :size="15" /></button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.reminders {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 180;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.reminder {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--accent);
  color: #fff;
  border-radius: 12px;
  padding: 0.55rem 0.8rem;
  box-shadow: var(--shadow-lg);
  font-size: 0.88rem;
  animation: pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(-14px) scale(0.94);
  }
}
.bell {
  display: inline-flex;
  opacity: 0.9;
}
.text em {
  font-style: normal;
  opacity: 0.85;
  margin-left: 0.3rem;
}
.x {
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.slide-leave-active {
  transition: opacity 0.2s ease;
}
.slide-leave-to {
  opacity: 0;
}
</style>
