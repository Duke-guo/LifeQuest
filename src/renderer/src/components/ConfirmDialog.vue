<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useConfirmStore } from '../stores/confirm'

const confirm = useConfirmStore()
const o = computed(() => confirm.opts)

function onKey(e: KeyboardEvent): void {
  if (!confirm.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    confirm.settle(false)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    confirm.settle(true)
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <transition name="cf">
    <div v-if="confirm.open" class="cf-mask" @click.self="confirm.settle(false)">
      <div class="cf-box" role="dialog" aria-modal="true">
        <h3 class="cf-title">{{ o.title }}</h3>
        <p v-if="o.message" class="cf-msg">{{ o.message }}</p>
        <p v-if="o.detail" class="cf-detail">{{ o.detail }}</p>

        <div class="cf-actions">
          <button class="cf-btn" @click="confirm.settle(false)">
            {{ o.cancelText ?? '取消' }}
          </button>
          <button
            class="cf-btn ok"
            :class="{ danger: o.danger !== false }"
            @click="confirm.settle(true)"
          >
            {{ o.confirmText ?? '删除' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.cf-mask {
  position: fixed;
  inset: 0;
  /* 要比任何弹窗都高：确认框可能从任务弹窗、编辑弹窗里弹出来 */
  z-index: 600;
  background: rgba(20, 14, 13, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.cf-box {
  width: min(400px, 100%);
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 18px;
  padding: 1.2rem 1.25rem 1.1rem;
  box-shadow: var(--shadow-lg);
  animation: cfIn 0.22s cubic-bezier(0.34, 1.4, 0.64, 1);
}
@keyframes cfIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }
}
.cf-title {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-size: 1.18rem;
  color: var(--text);
}
.cf-msg {
  margin: 0 0 0.3rem;
  font-size: 0.92rem;
  color: var(--text);
  word-break: break-word;
}
.cf-detail {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-3);
  line-height: 1.6;
}
.cf-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.1rem;
}
.cf-btn {
  font-family: var(--font-display);
  font-size: 0.92rem;
  padding: 0.32rem 1rem;
  border: 2px solid var(--border);
  border-radius: 13px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  box-shadow: 0 3px 0 var(--surface-2);
  transition:
    transform 0.14s ease,
    box-shadow 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease,
    background-color 0.14s ease;
}
.cf-btn:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
  color: var(--accent);
}
.cf-btn.ok {
  background: var(--success);
  border-color: var(--success);
  color: #fff;
  box-shadow: 0 3px 0 rgba(76, 194, 122, 0.28);
}
.cf-btn.ok.danger {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
  box-shadow: 0 3px 0 rgba(239, 107, 92, 0.3);
}
.cf-btn.ok:hover {
  filter: brightness(1.06);
  color: #fff;
  border-color: transparent;
  border-color: var(--danger);
}
.cf-btn.ok:not(.danger):hover {
  border-color: var(--success);
}
.cf-enter-active,
.cf-leave-active {
  transition: opacity 0.18s ease;
}
.cf-enter-from,
.cf-leave-to {
  opacity: 0;
}
</style>
