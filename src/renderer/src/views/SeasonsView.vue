<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSeasonsStore, derivePhase } from '../stores/seasons'
import { useGamificationStore } from '../stores/gamification'
import { dataApi } from '../services/data'
import type { Season, SeasonType } from '../../../shared/types'

const seasonsStore = useSeasonsStore()
const gStore = useGamificationStore()

const name = ref('')
const type = ref<SeasonType>('main')
const start = ref('')
const end = ref('')
const categories = ref('')
const reviewMsg = ref('')

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

async function generateReview(season: Season): Promise<void> {
  const tasksFile = await dataApi.readTasks()
  const tasks = tasksFile?.tasks ?? []
  const inSeason = tasks.filter((t) => {
    if (t.seasonId === season.id) return true
    if (t.completedAt) {
      const d = t.completedAt.slice(0, 10)
      return d >= season.start && d <= season.end
    }
    return false
  })
  const done = inSeason.filter((t) => t.status === 'done')
  const rate = inSeason.length ? Math.round((done.length / inSeason.length) * 100) : 0
  const journals = await dataApi.listFiles('journal', '.md')
  const journalsInRange = journals.filter((f) => {
    const d = f.replace('.md', '')
    return d >= season.start && d <= season.end
  })
  const notes = await dataApi.listFiles('notes', '.md')
  const timeline = done
    .filter((t) => t.completedAt)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? -1 : 1))

  const lines = [
    `# ${season.name} · 赛季回顾`,
    '',
    `- 类型：${season.type === 'main' ? '主线' : '支线'}`,
    `- 时间：${season.start} ~ ${season.end}（${derivePhase(season.start, season.end)}）`,
    `- 类别：${season.categories.join('、') || '无'}`,
    '',
    '## 统计',
    `- 任务：完成 ${done.length} / ${inSeason.length}（完成率 ${rate}%）`,
    `- 日记：${journalsInRange.length} 篇`,
    `- 笔记：${notes.length} 篇（总计）`,
    '',
    '## 成就',
    ...gStore.achievements.map((a) => `- ${a.achieved ? '🏅' : '🔒'} ${a.name}（${a.progress}/${a.target}）`),
    '',
    '## 完成时间轴',
    ...(timeline.length ? timeline.map((t) => `- ${t.completedAt!.slice(0, 10)} ${t.title}`) : ['（暂无完成记录）']),
    '',
    '## 亮点与待改进',
    `- 亮点：${done.length >= 3 ? '任务完成度不错，保持节奏' : '已经起步，继续积累'}`,
    `- 待改进：${inSeason.length - done.length > 0 ? `还有 ${inSeason.length - done.length} 个任务待完成` : '本季任务已全部完成'}`
  ]

  await dataApi.writeMarkdown(`archive/${season.id}-回顾.md`, lines.join('\n'))
  reviewMsg.value = `回顾已生成：archive/${season.id}-回顾.md`
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
      <h3>成长概览</h3>
      <p class="level">Lv.{{ gStore.level }} · {{ gStore.xp }} XP</p>
      <div class="achievements">
        <div
          v-for="a in gStore.achievements"
          :key="a.id"
          class="badge"
          :class="{ achieved: a.achieved }"
        >
          <div class="badge-name">{{ a.achieved ? '🏅' : '🔒' }} {{ a.name }}</div>
          <div class="badge-desc">{{ a.desc }}（{{ a.progress }}/{{ a.target }}）</div>
        </div>
      </div>
    </section>

    <section class="seasons">
      <h3>赛季列表</h3>
      <div v-for="s in seasonsStore.seasons" :key="s.id" class="season-row card">
        <div class="season-info">
          <div class="season-name">{{ s.type === 'main' ? '🗡' : '🧭' }} {{ s.name }}</div>
          <div class="season-meta">{{ s.start }} ~ {{ s.end }} · {{ derivePhase(s.start, s.end) }}</div>
          <div v-if="s.categories.length" class="season-cats">类别：{{ s.categories.join('、') }}</div>
        </div>
        <div class="season-actions">
          <button class="review-btn" @click="generateReview(s)">生成回顾</button>
          <button class="del" @click="seasonsStore.remove(s.id)">✕</button>
        </div>
      </div>
      <div v-if="seasonsStore.seasons.length === 0" class="empty">还没有赛季，下面创建一个</div>
      <p v-if="reviewMsg" class="msg">{{ reviewMsg }}</p>
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
        <input v-model="start" type="date" title="开始日期" />
        <span>~</span>
        <input v-model="end" type="date" title="结束日期" />
      </div>
      <div class="form-row">
        <input v-model="categories" placeholder="类别（逗号分隔，如：打卡计划, 期末考核）" />
        <button class="add-btn" @click="createSeason">创建</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.level {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--accent);
  margin: 0.5rem 0 1rem;
}
.achievements {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
}
.badge {
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 0.75rem;
  color: #bbb;
}
.badge.achieved {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: #92400e;
}
.badge-name {
  font-weight: 600;
}
.badge-desc {
  font-size: 0.8rem;
  margin-top: 0.2rem;
}
.season-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.season-name {
  font-weight: 600;
}
.season-meta {
  font-size: 0.85rem;
  color: #888;
  margin-top: 0.2rem;
}
.season-cats {
  font-size: 0.8rem;
  color: #666;
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
  background: #fff;
  color: var(--accent);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
}
.del {
  border: none;
  background: none;
  color: #ccc;
  cursor: pointer;
}
.del:hover {
  color: #ef4444;
}
.msg {
  color: #16a34a;
  font-size: 0.85rem;
  margin-top: 0.5rem;
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
  padding: 0.5rem 0.6rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.form-row input[placeholder] {
  flex: 1;
  min-width: 200px;
}
.add-btn {
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
</style>
