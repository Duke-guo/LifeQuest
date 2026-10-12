<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import DateField from './DateField.vue'
import TimeField from './TimeField.vue'
import { REPEAT_LABELS, REPEAT_OPTIONS, everyNDays } from '../utils/schedule'
import type { TaskChain, RepeatMode } from '../../../shared/types'

const props = defineProps<{ modelValue: TaskChain[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: TaskChain[]] }>()

function set(i: number, patch: Partial<TaskChain>): void {
  emit(
    'update:modelValue',
    props.modelValue.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
  )
}

function add(): void {
  emit('update:modelValue', [
    ...props.modelValue,
    {
      due: '',
      repeat: 'weekly' as RepeatMode,
      repeatEvery: null,
      repeatUntil: null,
      startTime: null,
      endTime: null
    }
  ])
}

function remove(i: number): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((_c, idx) => idx !== i)
  )
}
</script>

<template>
  <div class="chain">
    <div v-for="(c, i) in modelValue" :key="i" class="chain-row">
      <DateField
        :model-value="c.due"
        placeholder="第一天"
        title="这条链的第一天（决定星期几）"
        :marks="[]"
        @update:model-value="(v: string) => set(i, { due: v })"
      />
      <select
        :value="c.repeat"
        class="c-mode"
        @change="set(i, { repeat: ($event.target as HTMLSelectElement).value as RepeatMode })"
      >
        <option v-for="m in REPEAT_OPTIONS" :key="m" :value="m">{{ REPEAT_LABELS[m] }}</option>
      </select>
      <span v-if="c.repeat === 'every-n'" class="c-every">
        每 <input
          :value="c.repeatEvery ?? 2"
          type="number"
          min="1"
          max="180"
          class="c-num"
          @input="set(i, { repeatEvery: everyNDays({ repeatEvery: Number(($event.target as HTMLInputElement).value) }) })"
        /> 天
      </span>
      <DateField
        :model-value="c.repeatUntil ?? ''"
        placeholder="不限"
        title="重复截止（留空 = 不限）"
        @update:model-value="(v: string) => set(i, { repeatUntil: v || null })"
      />
      <TimeField
        :model-value="c.startTime ?? ''"
        placeholder="开始"
        @update:model-value="(v: string) => set(i, { startTime: v || null })"
      />
      <span class="dash">–</span>
      <TimeField
        :model-value="c.endTime ?? ''"
        placeholder="结束"
        end-of-day
        @update:model-value="(v: string) => set(i, { endTime: v || null })"
      />
      <button type="button" class="c-del" title="删掉这条链" @click="remove(i)">
        <AppIcon name="close" :size="13" />
      </button>
    </div>
    <button type="button" class="c-add" @click="add">＋ 加一条重复时段</button>
    <span class="c-hint">
      一个任务可以有多条重复（比如高数一周两节：周二一条、周四一条），各自带自己的时间和截止。
      想跳过某一次（放假 / 调课），去任务卡上的日历按钮里删。
    </span>
  </div>
</template>

<style scoped>
.chain {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.chain-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.chain-row input,
.chain-row select {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}
.c-date {
  width: 150px;
}
.c-mode {
  width: 92px;
}
.c-every {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  color: var(--text-2);
}
.c-num {
  width: 52px;
  text-align: center;
  font-family: var(--font-num);
  padding: 0.35rem 0.3rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}
.c-time {
  width: 104px;
}
.c-del {
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
.c-del:hover {
  border-color: var(--danger);
  color: var(--danger);
}
.c-add {
  align-self: flex-start;
  border: 1px dashed var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 8px;
  padding: 0.3rem 0.7rem;
  font-size: 0.82rem;
  cursor: pointer;
}
.c-add:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.c-hint {
  font-size: 0.72rem;
  color: var(--text-3);
  line-height: 1.5;
}
</style>
