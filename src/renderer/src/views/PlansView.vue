<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { usePlansStore } from '../stores/plans'
import { useSemesterStore } from '../stores/semester'
import { useTasksStore } from '../stores/tasks'
import { useConfirmStore } from '../stores/confirm'
import AppIcon from '../components/AppIcon.vue'
import DateField from '../components/DateField.vue'

const store = usePlansStore()
const semesterStore = useSemesterStore()
const tasksStore = useTasksStore()
const confirm = useConfirmStore()

/** 删除活动计划前确认 */
async function removePlan(id: string, name: string): Promise<void> {
  const ok = await confirm.ask({
    title: '删除这个计划？',
    message: `「${name}」`,
    detail: '计划会从 plans.json 里删掉，日历上对应的色块也会消失。',
    confirmText: '删除计划'
  })
  if (ok) await store.remove(id)
}

/** 删除学期假期前确认（会影响校历的停课日） */
async function removeHoliday(id: string, name: string): Promise<void> {
  const ok = await confirm.ask({
    title: '删除这个假期？',
    message: `「${name}」`,
    detail: '删掉后这些天会恢复成上课日，日历上的放假标记也会消失。',
    confirmText: '删除假期'
  })
  if (ok) await semesterStore.removeHoliday(id)
}

const title = ref('')
const start = ref('')
const end = ref('')
const notes = ref('')
const savedHint = ref('')

// 新增假期
const hName = ref('')
const hStart = ref('')
const hEnd = ref('')

onMounted(async () => {
  await store.load()
  await semesterStore.load()
  if (!tasksStore.loaded) await tasksStore.load()
})

const sem = computed(() => semesterStore.semester)

/** 学期里安排的课程数（用于估算教学周数） */
const courseCount = computed(
  () => tasksStore.tasks.filter((t) => t.repeat && t.repeat !== 'none').length
)

async function saveSemester(): Promise<void> {
  await semesterStore.save()
  savedHint.value = '学期计划已保存（日历会按它标色并跳过停课日）'
  window.setTimeout(() => (savedHint.value = ''), 2500)
}

async function addHoliday(): Promise<void> {
  if (!hName.value.trim() || !hStart.value) return
  await semesterStore.addHoliday({
    name: hName.value.trim(),
    start: hStart.value,
    end: hEnd.value || hStart.value,
    noClass: true
  })
  hName.value = ''
  hStart.value = ''
  hEnd.value = ''
}

async function createPlan(): Promise<void> {
  const t = title.value.trim()
  if (!t) return
  await store.create({ title: t, start: start.value, end: end.value, notes: notes.value })
  title.value = ''
  start.value = ''
  end.value = ''
  notes.value = ''
}
</script>

<template>
  <div class="plans-view">
    <header class="view-head">
      <div>
        <h2>计划</h2>
        <p class="sub">学期计划管节奏，活动计划管具体安排</p>
      </div>
    </header>

    <!-- ===== 学期计划（校历） ===== -->
    <section class="card semester">
      <div class="sem-head">
        <h3><AppIcon name="calendar" :size="17" /> 学期计划（校历）</h3>
        <span class="sem-sub">日历的颜色条与「第几周」都来自这里</span>
      </div>
      <p class="hint">
        这里是整个学期的骨架，填好之后会同时影响四处：
        <b>① 日历上的「第几周」</b>（开学日所在那周算第 1 周）；
        <b>② 放假当天的课自动停</b>（下面「假期」里勾了停课的日子，那天的课不会排出来）；
        <b>③ 首页的学期进度条与「距期末还有几天」</b>；
        <b>④ 一天的性质</b>（上课 / 周末 / 考试 / 放假）自动判断。
        换学期时改这里即可，历史数据不受影响。
      </p>

      <div class="grid">
        <label class="field">
          <span>名称</span>
          <input v-model="sem.name" />
        </label>
        <label class="field">
          <span>开学日（第 1 周周一）</span>
          <DateField v-model="sem.start" />
        </label>
        <label class="field">
          <span>教学结束</span>
          <DateField v-model="sem.teachingEnd" />
        </label>
        <label class="field">
          <span>考试周开始</span>
          <DateField v-model="sem.examStart" />
        </label>
        <label class="field">
          <span>考试周结束</span>
          <DateField v-model="sem.examEnd" />
        </label>
      </div>

      <div class="preview">
        教学共
        <b>{{ Math.max(0, Math.round((new Date(sem.teachingEnd).getTime() - new Date(sem.start).getTime()) / 604800000)) }}</b>
        周 · 已安排 <b>{{ courseCount }}</b> 个重复日程 · 停课 <b>{{ sem.holidays.length }}</b> 项
      </div>

      <div class="holidays">
        <div class="holiday-head">停课日（这些日期不排课）</div>
        <div v-for="h in sem.holidays" :key="h.id" class="holiday-row">
          <input v-model="h.name" class="h-name" />
          <DateField v-model="h.start" />
          <span class="dash">~</span>
          <DateField v-model="h.end" />
          <button class="icon-btn" @click="removeHoliday(h.id, h.name)">
            <AppIcon name="close" :size="14" />
          </button>
        </div>
        <div class="holiday-row new">
          <input v-model="hName" class="h-name" placeholder="新增假期名（如 国庆节）" />
          <DateField v-model="hStart" />
          <span class="dash">~</span>
          <DateField v-model="hEnd" />
          <button class="ghost-mini" @click="addHoliday">＋ 添加</button>
        </div>
      </div>

      <div class="sem-actions">
        <button class="primary" @click="saveSemester">保存学期计划</button>
        <span v-if="savedHint" class="ok">{{ savedHint }}</span>
      </div>
    </section>

    <!-- ===== 活动计划 ===== -->
    <section class="card">
      <h3>新建活动计划</h3>
      <p class="hint">
        给一段时间定一个主题（复习周、比赛、旅行、实习…）。保存后它会<b>铺满这段日期的每一天</b>：
        月视图每天多一条靛蓝小标签、周/日视图里显示成一条计划，提醒你这段时间的主线是什么。
        计划不占时间轴、也不计时长，所以不会把那几天标成「很忙」——它的作用是<b>把主题摆在那儿</b>。
      </p>
      <div class="grid">
        <label class="field grow">
          <span>计划名</span>
          <input v-model="title" placeholder="如：社团招新、期末复习周" />
        </label>
        <label class="field">
          <span>开始</span>
          <DateField v-model="start" />
        </label>
        <label class="field">
          <span>结束</span>
          <DateField v-model="end" />
        </label>
      </div>
      <div class="row">
        <input v-model="notes" class="notes-input" placeholder="备注（可选）" />
        <button class="primary" @click="createPlan">添加</button>
      </div>
    </section>

    <section>
      <div v-for="p in store.plans" :key="p.id" class="plan-row card">
        <div>
          <div class="plan-title"><AppIcon name="plans" :size="17" /> {{ p.title }}</div>
          <div v-if="p.start || p.end" class="plan-meta">{{ p.start || '…' }} ~ {{ p.end || '…' }}</div>
          <div v-if="p.notes" class="plan-notes">{{ p.notes }}</div>
        </div>
        <button class="del" @click="removePlan(p.id, p.title)">✕</button>
      </div>
      <div v-if="store.plans.length === 0" class="empty">还没有活动计划</div>
    </section>
  </div>
</template>

<style scoped>
h3 {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1rem;
  margin-bottom: 0.6rem;
}
.sem-head {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  flex-wrap: wrap;
}
.sem-sub {
  font-size: 0.76rem;
  color: var(--text-3);
}
/* 说明块：告诉用户"填了之后会发生什么" */
.hint {
  margin: 0 0 0.8rem;
  padding: 0.6rem 0.8rem;
  border-left: 3px solid var(--accent);
  border-radius: 0 8px 8px 0;
  background: var(--accent-soft);
  color: var(--text-2);
  font-size: 0.82rem;
  line-height: 1.75;
}
.hint b {
  color: var(--accent);
}
.grid {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  margin-bottom: 0.7rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.74rem;
  color: var(--text-3);
}
.field.grow {
  flex: 1;
  min-width: 180px;
}
.field input {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}
.preview {
  font-size: 0.82rem;
  color: var(--text-2);
  background: var(--surface-2);
  border-radius: 9px;
  padding: 0.5rem 0.7rem;
  margin-bottom: 0.8rem;
}
.preview b {
  color: var(--accent);
}
.holidays {
  margin-bottom: 0.8rem;
}
.holiday-head {
  font-size: 0.78rem;
  color: var(--text-3);
  margin-bottom: 0.4rem;
}
.holiday-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.3rem;
}
.holiday-row input {
  padding: 0.3rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
}
.h-name {
  width: 150px;
}
.dash {
  color: var(--text-3);
}
.new {
  margin-top: 0.4rem;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--border);
}
.icon-btn {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  display: inline-flex;
}
.icon-btn:hover {
  color: var(--danger);
}
.ghost-mini {
  border: 1px dashed var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 8px;
  padding: 0.25rem 0.6rem;
  font-size: 0.78rem;
  cursor: pointer;
}
.ghost-mini:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.sem-actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.primary {
  padding: 0.5rem 1.2rem;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}
.ok {
  color: var(--success);
  font-size: 0.82rem;
}
.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.notes-input {
  flex: 1;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text);
}
.plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.plan-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.plan-meta,
.plan-notes {
  font-size: 0.84rem;
  color: var(--text-2);
  margin-top: 0.2rem;
}
.del {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}
.del:hover {
  color: var(--danger);
}
</style>
