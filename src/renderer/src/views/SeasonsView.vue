<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSeasonsStore, derivePhase } from '../stores/seasons'
import { useGamificationStore } from '../stores/gamification'
import { useConfirmStore } from '../stores/confirm'
import AppIcon from '../components/AppIcon.vue'
import DateField from '../components/DateField.vue'
import SeasonReviewModal from '../components/SeasonReviewModal.vue'
import type { Season, SeasonType, AchievementMetric } from '../../../shared/types'

const seasonsStore = useSeasonsStore()
const gStore = useGamificationStore()
const confirm = useConfirmStore()

/** 删除赛季前确认 */
async function removeSeason(s: Season): Promise<void> {
  const ok = await confirm.ask({
    title: '删除这个赛季？',
    message: `「${s.name}」`,
    detail: '赛季本身会被删掉；已经归到这个赛季下的任务不会跟着消失。',
    confirmText: '删除赛季'
  })
  if (ok) await seasonsStore.remove(s.id)
}

const name = ref('')
const type = ref<SeasonType>('main')
const start = ref('')
const end = ref('')
const categories = ref('')

const reviewSeason = ref<Season | null>(null)

/** 自定义成就表单 */
const customName = ref('')
const customMetric = ref<AchievementMetric>('tasks')
const customTarget = ref(10)
const customSeasonId = ref<string>('')

onMounted(async () => {
  await seasonsStore.load()
  await gStore.refresh()
})

async function createSeason(): Promise<void> {
  const n = name.value.trim()
  if (!n || !start.value || !end.value) return
  await seasonsStore.create({
    name: n,
    type: type.value,
    start: start.value,
    end: end.value,
    categories: categories.value
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
  })
  name.value = ''
  start.value = ''
  end.value = ''
  categories.value = ''
  await gStore.refresh()
}

async function addCustom(): Promise<void> {
  if (!customName.value.trim()) return
  await gStore.addCustom(customName.value, customMetric.value, customTarget.value, customSeasonId.value || null)
  customName.value = ''
}

function seasonName(id: string | null | undefined): string {
  if (!id) return ''
  return seasonsStore.seasons.find((s) => s.id === id)?.name ?? ''
}

/** 称号阶梯的进度条：向下一档走多少了 */
function ladderPct(t: { value: number; nextNeed: number | null }): number {
  if (!t.nextNeed) return 100
  return Math.max(6, Math.min(100, Math.round((t.value / t.nextNeed) * 100)))
}
</script>

<template>
  <div class="seasons-view">
    <header class="view-head">
      <div>
        <h2>赛季 / 成长</h2>
        <p class="sub">赛季是内容节奏，不是压力来源</p>
      </div>
    </header>

    <section class="growth card">
      <div class="title-hero">
        <div class="title-main">
          <span class="title-kicker">你现在是</span>
          <span class="title-name">{{ gStore.mainTitle }}</span>
        </div>
        <span class="level-corner" title="等级只作装饰，不作为压力">Lv.{{ gStore.level }} · {{ gStore.xp }} XP</span>
      </div>

      <div class="ladders">
        <div v-for="t in gStore.titles" :key="t.label" class="ladder">
          <div class="ladder-head">
            <span class="ladder-label">{{ t.label }}</span>
            <span class="ladder-name">{{ t.name }}</span>
          </div>
          <div class="ladder-bar"><i :style="{ width: ladderPct(t) + '%' }"></i></div>
          <span class="ladder-next">
            {{ t.nextName ? `下一步「${t.nextName}」（${t.nextNeed}）` : '已达最高' }}
          </span>
        </div>
      </div>

      <h4 class="sec-title">里程碑</h4>
      <div class="achievements">
        <div
          v-for="a in gStore.milestones"
          :key="a.id"
          class="badge"
          :class="{ achieved: a.achieved }"
          :title="a.unlockedAt ? `点亮于 ${a.unlockedAt}` : ''"
        >
          <div class="badge-name">
            <AppIcon :name="a.achieved ? a.icon : 'lock'" :size="15" />
            {{ a.name }}
          </div>
          <div class="badge-desc">{{ a.desc }}</div>
          <div class="badge-bar"><i :style="{ width: Math.min(100, Math.round((a.progress / a.target) * 100)) + '%' }"></i></div>
          <div class="badge-meta">{{ a.achieved ? '已点亮' : `${a.progress}/${a.target}` }}</div>
        </div>
      </div>

      <h4 class="sec-title">自定义成就</h4>
      <div v-if="gStore.custom.length" class="custom-list">
        <div
          v-for="a in gStore.custom"
          :key="a.id"
          class="custom-chip"
          :class="{ achieved: a.achieved }"
        >
          <span>{{ a.achieved ? '★' : '○' }} {{ a.name }}</span>
          <span class="custom-meta">
            {{ gStore.METRIC_LABEL[a.metric] }} {{ Math.min(a.progress, a.target) }}/{{ a.target }}
            <template v-if="a.seasonId"> · {{ seasonName(a.seasonId) }}</template>
          </span>
          <button class="custom-x" title="删除这个目标" @click="gStore.removeCustom(a.id)">✕</button>
        </div>
      </div>
      <div class="custom-add">
        <input v-model="customName" placeholder="这个赛季我想做到…（如：读完 3 本闲书）" />
        <select v-model="customMetric">
          <option value="tasks">完成任务</option>
          <option value="daily">每日打卡</option>
          <option value="notes">写笔记</option>
          <option value="journals">写日记</option>
        </select>
        <input v-model.number="customTarget" type="number" min="1" max="999" class="target" />
        <select v-model="customSeasonId" title="只统计这个赛季区间内的数据；选「全局」就不分赛季">
          <option value="">全局（不分赛季）</option>
          <option v-for="s in seasonsStore.seasons" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <button class="add-btn" @click="addCustom">添加目标</button>
      </div>
    </section>

    <section class="seasons">
      <h3>赛季列表</h3>
      <div v-for="s in seasonsStore.seasons" :key="s.id" class="season-row card">
        <div class="season-info">
          <div class="season-name">
            <AppIcon :name="s.type === 'main' ? 'tasks' : 'compass'" :size="17" />
            {{ s.name }}
          </div>
          <div class="season-meta">{{ s.start }} ~ {{ s.end }} · {{ derivePhase(s.start, s.end) }}</div>
          <div v-if="s.categories.length" class="season-cats">类别：{{ s.categories.join('、') }}</div>
        </div>
        <div class="season-actions">
          <button class="review-btn" @click="reviewSeason = s">生成回顾</button>
          <button class="del" @click="removeSeason(s)">✕</button>
        </div>
      </div>
      <div v-if="seasonsStore.seasons.length === 0" class="empty">还没有赛季，下面创建一个</div>
    </section>

    <section class="create card">
      <h3>新建赛季</h3>
      <div class="form-row">
        <input v-model="name" placeholder="赛季名（如：大一上学期）" />
        <select v-model="type">
          <option value="main">主线（学期）</option>
          <option value="side">支线（假期）</option>
        </select>
      </div>
      <div class="form-row">
        <DateField v-model="start" title="开始日期" />
        <span>~</span>
        <DateField v-model="end" title="结束日期" />
      </div>
      <div class="form-row">
        <input v-model="categories" placeholder="类别（逗号分隔，如：打卡计划, 期末考核）" />
        <button class="add-btn" @click="createSeason">创建</button>
      </div>
    </section>

    <SeasonReviewModal v-if="reviewSeason" :season="reviewSeason" @close="reviewSeason = null" />
  </div>
</template>

<style scoped>
/* 称号为主，等级藏角落 */
.title-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.title-main {
  display: flex;
  flex-direction: column;
}
.title-kicker {
  font-size: 0.8rem;
  color: var(--text-3);
}
.title-name {
  font-family: var(--font-display);
  font-size: 2rem;
  color: var(--accent);
  line-height: 1.15;
}
.level-corner {
  font-size: 0.74rem;
  color: var(--text-3);
  border: 1px dashed var(--border);
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}
.ladders {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.8rem;
  margin: 0.9rem 0 1rem;
}
.ladder-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.ladder-label {
  font-size: 0.74rem;
  color: var(--text-3);
}
.ladder-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}
.ladder-bar {
  height: 6px;
  background: var(--surface-2);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 0.3rem;
}
.ladder-bar i {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.3s ease;
}
.ladder-next {
  font-size: 0.72rem;
  color: var(--text-3);
}
.sec-title {
  margin: 1rem 0 0.5rem;
  font-family: var(--font-display);
  color: var(--text-2);
}
.achievements {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 0.7rem;
}
.badge {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.7rem;
  color: var(--text-3);
}
.badge.achieved {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
}
.badge-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text);
}
.badge.achieved .badge-name {
  color: var(--accent-text);
}
.badge-desc {
  font-size: 0.78rem;
  margin-top: 0.2rem;
}
.badge-bar {
  height: 5px;
  background: var(--surface-2);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 0.5rem;
}
.badge-bar i {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
}
.badge-meta {
  font-size: 0.72rem;
  margin-top: 0.25rem;
}
.custom-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.custom-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px dashed var(--border);
  border-radius: 999px;
  padding: 3px 6px 3px 10px;
  font-size: 0.82rem;
  color: var(--text-2);
}
.custom-chip.achieved {
  border-style: solid;
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
}
.custom-meta {
  font-size: 0.72rem;
  color: var(--text-3);
}
.custom-x {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.72rem;
}
.custom-x:hover {
  color: var(--danger);
}
.custom-add {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.6rem;
  flex-wrap: wrap;
}
.custom-add input,
.custom-add select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
}
.custom-add input[placeholder] {
  flex: 1;
  min-width: 200px;
}
.custom-add .target {
  width: 64px;
  text-align: center;
  font-family: var(--font-num);
}
.season-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.season-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.season-meta {
  font-size: 0.85rem;
  color: var(--text-2);
  margin-top: 0.2rem;
}
.season-cats {
  font-size: 0.8rem;
  color: var(--text-2);
  margin-top: 0.2rem;
}
.season-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.review-btn {
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.85rem;
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
.form-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
}
.form-row input,
.form-row select {
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
}
.form-row input[placeholder] {
  flex: 1;
  min-width: 200px;
}
.add-btn {
  padding: 0.55rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}
.empty {
  color: var(--text-3);
  padding: 1rem 0;
}
h3 {
  font-size: 1.1rem;
}
</style>
