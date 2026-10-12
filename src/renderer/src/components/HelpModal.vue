<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import type { Help } from '../utils/helps'

const props = defineProps<{ help: Help }>()
const emit = defineEmits<{ close: [] }>()

const items = computed(() => props.help.items)
</script>

<template>
  <Teleport to="body">
    <div class="hm-mask" @click.self="emit('close')">
      <div class="hm-box" role="dialog" aria-modal="true">
        <header class="hm-head">
          <div>
            <h3>{{ help.title }} · 怎么用</h3>
            <p class="hm-sub">{{ help.tagline }}</p>
          </div>
          <button class="hm-x" title="关闭" @click="emit('close')"><AppIcon name="close" :size="18" /></button>
        </header>

        <div class="hm-body">
          <div v-for="it in items" :key="it.h" class="hm-item">
            <h4>{{ it.h }}</h4>
            <p>{{ it.t }}</p>
          </div>
        </div>

        <footer class="hm-foot">
          <span class="hm-note">更多整体介绍：左上角罗盘 → 新手导引</span>
          <button class="hm-btn" @click="emit('close')">知道了</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.hm-mask {
  position: fixed;
  inset: 0;
  z-index: 480;
  background: rgba(20, 14, 13, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.hm-box {
  width: min(480px, 100%);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow-lg);
  animation: hmIn 0.22s cubic-bezier(0.34, 1.4, 0.64, 1);
}
@keyframes hmIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.97);
  }
}
.hm-head {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 1.1rem 1.2rem 0.5rem;
}
.hm-head h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
}
.hm-sub {
  margin: 2px 0 0;
  font-size: 0.76rem;
  color: var(--text-3);
}
.hm-x {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  padding: 2px;
}
.hm-x:hover {
  color: var(--accent);
}
.hm-body {
  overflow-y: auto;
  padding: 0.3rem 1.2rem 0.5rem;
}
.hm-item {
  margin: 0.7rem 0;
}
.hm-item h4 {
  margin: 0 0 0.15rem;
  font-size: 0.9rem;
  color: var(--accent-text);
  font-family: var(--font-display);
}
.hm-item p {
  margin: 0;
  font-size: 0.86rem;
  color: var(--text-2);
  line-height: 1.6;
}
.hm-foot {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1.2rem 1rem;
  border-top: 1px solid var(--border);
  margin-top: 0.2rem;
}
.hm-note {
  flex: 1;
  font-size: 0.74rem;
  color: var(--text-3);
}
.hm-btn {
  padding: 0.4rem 1.1rem;
  border: 2px solid var(--accent);
  border-radius: 11px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 0.9rem;
}
.hm-btn:hover {
  filter: brightness(1.05);
}
</style>
