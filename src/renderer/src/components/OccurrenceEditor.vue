<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import DateField from './DateField.vue'
import TimeField from './TimeField.vue'
import type { TaskOccurrence } from '../../../shared/types'

const props = defineProps<{ modelValue: TaskOccurrence[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: TaskOccurrence[]] }>()

function update(i: number, patch: Partial<TaskOccurrence>): void {
  const next = props.modelValue.map((o, idx) => (idx === i ? { ...o, ...patch } : o))
  emit('update:modelValue', next)
}

function add(): void {
  emit('update:modelValue', [...props.modelValue, { date: '', startTime: null, endTime: null }])
}

function remove(i: number): void {
  emit('update:modelValue', props.modelValue.filter((_o, idx) => idx !== i))
}
</script>

<template>
  <div class="occ">
    <div v-for="(o, i) in modelValue" :key="i" class="occ-row">
      <DateField
        :model-value="o.date"
        placeholder="选日期"
        @update:model-value="(v: string) => update(i, { date: v })"
      />
      <TimeField
        :model-value="o.startTime ?? ''"
        placeholder="开始"
        @update:model-value="(v: string) => update(i, { startTime: v || null })"
      />
      <span class="dash">–</span>
      <TimeField
        :model-value="o.endTime ?? ''"
        placeholder="结束"
        end-of-day
        @update:model-value="(v: string) => update(i, { endTime: v || null })"
      />
      <button type="button" class="occ-del" title="删掉这一次" @click="remove(i)">
        <AppIcon name="close" :size="13" />
      </button>
    </div>
    <button type="button" class="occ-add" @click="add">＋ 加一次</button>
    <span class="occ-hint">留空时间就沿用上面的时间段；每次都会单独排进日历。</span>
  </div>
</template>

<style scoped>
.occ {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.occ-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.occ-date {
  width: 150px;
}
.occ-time {
  width: 104px;
}
.occ-row input {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}
.occ-del {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 8px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.occ-del:hover {
  border-color: var(--danger);
  color: var(--danger);
}
.occ-add {
  align-self: flex-start;
  border: 1px dashed var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 8px;
  padding: 0.3rem 0.7rem;
  font-size: 0.82rem;
  cursor: pointer;
}
.occ-add:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.occ-hint {
  font-size: 0.72rem;
  color: var(--text-3);
}
</style>
