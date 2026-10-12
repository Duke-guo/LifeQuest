<script setup lang="ts">
import { ref, computed } from 'vue'
import { dataApi } from '../services/data'
import { derivePhase } from '../stores/seasons'
import { useGamificationStore, type MilestoneState, type CustomState } from '../stores/gamification'
import AppIcon from './AppIcon.vue'
import type { Season } from '../../../shared/types'

/**
 * 赛季回顾：在应用里直接看（结算页），也能存成 Markdown / 复制全文。
 * 数据全部现算，不落任何中间文件。
 */
const props = defineProps<{ season: Season }>()
const emit = defineEmits<{ close: [] }>()

const gStore = useGamificationStore()

const loading = ref(true)
const saved = ref('')
const copied = ref('')

interface Review {
  phase: string
  rate: number
  done: number
  inSeason: number
  journals: number
  notes: number
  notesInSeason: number
  busyWeek: { start: string; end: string; count: number } | null
  lightWeek: { start: string; end: string; count: number } | null
  topNoteDay: { date: string; count: number } | null
  quote: { text: string; date: string } | null
  seasonAch: { name: string; desc: string; progress: number; target: number; achieved: boolean }[]
  milestones: MilestoneState[]
  custom: CustomState[]
  timeline: { date: string; title: string }[]
}

const review = ref<Review | null>(null)

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `周${WEEK[new Date(y, m - 1, d).getDay()]}`
}

function weekStartOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const sun = new Date(y, m - 1, d - dt.getDay())
  return toIso(sun)
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toIso(new Date(y, m - 1, d + n))
}

async function load(): Promise<void> {
  loading.value = true
  const [tasksFile, journals, noteFiles] = await Promise.all([
    dataApi.readTasks(),
    dataApi.listFiles('journal', '.md'),
    dataApi.listFiles('notes', '.md')
  ])
  const tasks = tasksFile?.tasks ?? []
  const { start, end } = props.season

  const inRange = (d: string): boolean => d >= start && d <= end

  const inSeason = tasks.filter((t) => {
    if (t.seasonId === props.season.id) return true
    if (t.completedAt) return inRange(t.completedAt.slice(0, 10))
    return false
  })
  const done = inSeason.filter((t) => t.status === 'done')
  const rate = inSeason.length ? Math.round((done.length / inSeason.length) * 100) : 0

  const journalDates = journals.filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).map((f) => f.slice(0, 10))
  const journalsInSeason = journalDates.filter(inRange)

  // 笔记的日期：读每篇的 front matter
  const noteDates: string[] = []
  for (const f of noteFiles) {
    try {
      const raw = await dataApi.readMarkdown(`notes/${f}`)
      const m = /^---\n([\s\S]*?)\n---/.exec(raw)
      const fm = m?.[1] ?? ''
      const dm = /^date:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(fm)
      if (dm) noteDates.push(dm[1])
    } catch {
      /* 忽略读不出的 */
    }
  }

  // 每周活跃度：日记 + 完成的日程/任务（用于挑最忙/最闲的一周）
  const weekMap = new Map<string, number>()
  const bump = (d: string): void => {
    if (!inRange(d)) return
    const wk = weekStartOf(d)
    weekMap.set(wk, (weekMap.get(wk) ?? 0) + 1)
  }
  for (const d of journalsInSeason) bump(d)
  for (const t of done) if (t.completedAt) bump(t.completedAt.slice(0, 10))

  let busyWeek: Review['busyWeek'] = null
  let lightWeek: Review['lightWeek'] = null
  const weeks = [...weekMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  if (weeks.length) {
    const max = weeks.reduce((a, b) => (b[1] > a[1] ? b : a))
    busyWeek = { start: max[0], end: addDays(max[0], 6), count: max[1] }
    if (weeks.length > 1) {
      const min = weeks.reduce((a, b) => (b[1] < a[1] ? b : a))
      lightWeek = { start: min[0], end: addDays(min[0], 6), count: min[1] }
    }
  }

  // 笔记最多的一天
  const noteDayMap = new Map<string, number>()
  for (const d of noteDates.filter(inRange)) noteDayMap.set(d, (noteDayMap.get(d) ?? 0) + 1)
  let topNoteDay: Review['topNoteDay'] = null
  if (noteDayMap.size) {
    const top = [...noteDayMap.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))
    topNoteDay = { date: top[0], count: top[1] }
  }

  // 随机抽一句本季日记原话
  let quote: Review['quote'] = null
  const pool = journalsInSeason.filter((d) => d !== undefined)
  for (let k = pool.length - 1; k >= 0; k--) {
    const d = pool[Math.floor(Math.random() * (k + 1))]
    pool.splice(pool.indexOf(d), 1)
    try {
      const raw = await dataApi.readMarkdown(`journal/${d}.md`)
      const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').split('\n')
      const line = body
        .map((s) => s.trim())
        .find((s) => s && !/^[#*\-]/.test(s) && s.length >= 6 && !/^!\[/.test(s))
      if (line) {
        quote = { text: line, date: d }
        break
      }
    } catch {
      /* 下一篇 */
    }
  }

  // 本季成就（按赛季算）
  const seasonAch: Review['seasonAch'] = [
    { name: '本季任务', desc: '完成本季任务', progress: done.length, target: Math.max(10, Math.min(30, Math.ceil(inSeason.length * 0.6))), achieved: false },
    { name: '本季记录', desc: '本季写日记', progress: journalsInSeason.length, target: 5, achieved: false },
    { name: '本季沉淀', desc: '本季写笔记', progress: noteDates.filter(inRange).length, target: 3, achieved: false }
  ]
  for (const a of seasonAch) a.achieved = a.progress >= a.target

  const timeline = done
    .filter((t) => t.completedAt)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? -1 : 1))
    .map((t) => ({ date: t.completedAt!.slice(0, 10), title: t.title }))

  review.value = {
    phase: derivePhase(props.season.start, props.season.end),
    rate,
    done: done.length,
    inSeason: inSeason.length,
    journals: journalsInSeason.length,
    notes: noteFiles.length,
    notesInSeason: noteDates.filter(inRange).length,
    busyWeek,
    lightWeek,
    topNoteDay,
    quote,
    seasonAch,
    milestones: gStore.milestones,
    custom: gStore.custom,
    timeline
  }
  loading.value = false
}

load()

function toMarkdown(r: Review): string {
  const L: string[] = []
  L.push(`# ${props.season.name} · 赛季回顾`, '')
  L.push(`- 类型：${props.season.type === 'main' ? '主线' : '支线'}`)
  L.push(`- 时间：${props.season.start} ~ ${props.season.end}（${r.phase}）`)
  L.push(`- 类别：${props.season.categories.join('、') || '无'}`, '')
  L.push('## 统计')
  L.push(`- 任务：完成 ${r.done} / ${r.inSeason}（完成率 ${r.rate}%）`)
  L.push(`- 日记：${r.journals} 篇`)
  L.push(`- 笔记：${r.notesInSeason} 篇（总计 ${r.notes}）`, '')
  L.push('## 高光时刻')
  if (r.busyWeek) L.push(`- 最忙的一周：${r.busyWeek.start} ~ ${r.busyWeek.end}（${r.busyWeek.count} 条记录）`)
  if (r.lightWeek) L.push(`- 最闲的一周：${r.lightWeek.start} ~ ${r.lightWeek.end}（${r.lightWeek.count} 条记录）`)
  if (r.topNoteDay) L.push(`- 笔记最多的一天：${r.topNoteDay.date}（${r.topNoteDay.count} 篇）`)
  if (!r.busyWeek && !r.topNoteDay) L.push('- 这一季还没留下足够的记录')
  if (r.quote) {
    L.push('', '## 你写过的一句话')
    L.push(`> ${r.quote.text}`)
    L.push(`> —— ${r.quote.date}`)
  }
  L.push('', '## 本季成就')
  for (const a of r.seasonAch) L.push(`- [${a.achieved ? '已点亮' : '进行中'}] ${a.name}（${Math.min(a.progress, a.target)}/${a.target}）`)
  L.push('', '## 里程碑成就')
  for (const a of r.milestones) L.push(`- [${a.achieved ? '已点亮' : '未点亮'}] ${a.name}（${Math.min(a.progress, a.target)}/${a.target}）`)
  if (r.custom.length) {
    L.push('', '## 自定义成就')
    for (const a of r.custom) L.push(`- [${a.achieved ? '已点亮' : '进行中'}] ${a.name}（${Math.min(a.progress, a.target)}/${a.target}）`)
  }
  L.push('', '## 完成时间轴')
  if (r.timeline.length) {
    for (const t of r.timeline) L.push(`- ${t.date} ${t.title}`)
  } else {
    L.push('- （暂无完成记录）')
  }
  L.push('', '## 下一步')
  const remain = r.inSeason - r.done
  L.push(`- ${remain > 0 ? `还有 ${remain} 个任务在进行中，不急，慢慢来` : '本季任务已全部完成，辛苦了'}`)
  return L.join('\n')
}

async function save(): Promise<void> {
  if (!review.value) return
  await dataApi.writeMarkdown(`archive/${props.season.id}-回顾.md`, toMarkdown(review.value))
  saved.value = '已保存：archive/' + props.season.id + '-回顾.md'
  window.setTimeout(() => (saved.value = ''), 2500)
}

async function copy(): Promise<void> {
  if (!review.value) return
  try {
    await navigator.clipboard.writeText(toMarkdown(review.value))
    copied.value = '已复制全文'
    window.setTimeout(() => (copied.value = ''), 1800)
  } catch {
    copied.value = '复制失败，试试「保存」'
    window.setTimeout(() => (copied.value = ''), 1800)
  }
}

const weekday = computed(() => (d: string) => weekdayOf(d))
</script>

<template>
  <Teleport to="body">
    <div class="rm-mask" @click.self="emit('close')">
      <div class="rm-box" role="dialog" aria-modal="true">
        <header class="rm-head">
          <div>
            <h3>{{ season.name }} · 赛季回顾</h3>
            <p class="rm-sub">{{ season.start }} ~ {{ season.end }} · {{ review?.phase }}</p>
          </div>
          <button class="rm-x" title="关闭" @click="emit('close')"><AppIcon name="close" :size="18" /></button>
        </header>

        <div v-if="loading" class="rm-loading">正在生成回顾…</div>

        <div v-else-if="review" class="rm-body">
          <div class="rm-stats">
            <div class="rm-stat"><b>{{ review.done }}</b><span>/ {{ review.inSeason }} 任务</span></div>
            <div class="rm-stat"><b>{{ review.rate }}%</b><span>完成率</span></div>
            <div class="rm-stat"><b>{{ review.journals }}</b><span>篇日记</span></div>
            <div class="rm-stat"><b>{{ review.notesInSeason }}</b><span>篇笔记</span></div>
          </div>

          <section v-if="review.busyWeek || review.topNoteDay" class="rm-sec">
            <h4>高光时刻</h4>
            <p v-if="review.busyWeek">
              🔥 最忙的一周：<b>{{ review.busyWeek.start }} ~ {{ review.busyWeek.end }}</b>（{{ review.busyWeek.count }} 条记录）
            </p>
            <p v-if="review.lightWeek">
              🍃 最闲的一周：<b>{{ review.lightWeek.start }} ~ {{ review.lightWeek.end }}</b>（{{ review.lightWeek.count }} 条记录）
            </p>
            <p v-if="review.topNoteDay">
              📝 笔记最多的一天：<b>{{ review.topNoteDay.date }}</b>（{{ review.topNoteDay.count }} 篇）
            </p>
          </section>

          <section v-if="review.quote" class="rm-sec quote">
            <h4>你写过的一句话</h4>
            <blockquote>{{ review.quote.text }}</blockquote>
            <span class="rm-quote-date">—— {{ review.quote.date }} · {{ weekday(review.quote.date) }}</span>
          </section>

          <section class="rm-sec">
            <h4>本季成就</h4>
            <div class="rm-ach">
              <div v-for="a in review.seasonAch" :key="a.name" class="rm-ach-row" :class="{ on: a.achieved }">
                <span>{{ a.achieved ? '★' : '○' }} {{ a.name }}</span>
                <span class="rm-ach-meta">{{ a.desc }} · {{ Math.min(a.progress, a.target) }}/{{ a.target }}</span>
              </div>
            </div>
          </section>

          <section class="rm-sec">
            <h4>里程碑成就</h4>
            <div class="rm-chips">
              <span
                v-for="a in review.milestones"
                :key="a.id"
                class="rm-chip"
                :class="{ on: a.achieved }"
                :title="`${a.desc}${a.unlockedAt ? ' · 点亮于 ' + a.unlockedAt : ''}`"
              >
                {{ a.achieved ? '★' : '○' }} {{ a.name }}
              </span>
            </div>
            <div v-if="review.custom.length" class="rm-chips">
              <span
                v-for="a in review.custom"
                :key="a.id"
                class="rm-chip custom"
                :class="{ on: a.achieved }"
                :title="`${a.name}（${Math.min(a.progress, a.target)}/${a.target}）`"
              >
                {{ a.achieved ? '★' : '○' }} {{ a.name }} {{ Math.min(a.progress, a.target) }}/{{ a.target }}
              </span>
            </div>
          </section>

          <section class="rm-sec">
            <h4>完成时间轴</h4>
            <div v-if="review.timeline.length" class="rm-tl">
              <div v-for="t in review.timeline" :key="t.date + t.title" class="rm-tl-row">
                <span class="rm-tl-date">{{ t.date }}</span>
                <span>{{ t.title }}</span>
              </div>
            </div>
            <p v-else class="rm-dim">（暂无完成记录）</p>
          </section>
        </div>

        <footer class="rm-foot">
          <button class="rm-btn ghost" @click="copy">复制全文</button>
          <button class="rm-btn" @click="save">保存为 Markdown</button>
          <span v-if="saved || copied" class="rm-ok">{{ saved || copied }}</span>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.rm-mask {
  position: fixed;
  inset: 0;
  z-index: 460;
  background: rgba(20, 14, 13, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.rm-box {
  width: min(600px, 100%);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow-lg);
  animation: rmIn 0.22s cubic-bezier(0.34, 1.4, 0.64, 1);
}
@keyframes rmIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.97);
  }
}
.rm-head {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 1.1rem 1.2rem 0.6rem;
}
.rm-head h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
}
.rm-sub {
  margin: 2px 0 0;
  font-size: 0.76rem;
  color: var(--text-3);
}
.rm-x {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  padding: 2px;
}
.rm-x:hover {
  color: var(--accent);
}
.rm-loading {
  padding: 2rem;
  text-align: center;
  color: var(--text-3);
}
.rm-body {
  overflow-y: auto;
  padding: 0 1.2rem;
}
.rm-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.rm-stat {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.5rem;
  text-align: center;
}
.rm-stat b {
  display: block;
  font-family: var(--font-num);
  font-size: 1.25rem;
  color: var(--accent);
}
.rm-stat span {
  font-size: 0.72rem;
  color: var(--text-3);
}
.rm-sec {
  margin: 0.8rem 0;
}
.rm-sec h4 {
  margin: 0 0 0.35rem;
  font-size: 0.92rem;
  color: var(--text-2);
  font-family: var(--font-display);
}
.rm-sec p {
  margin: 0.15rem 0;
  font-size: 0.86rem;
  color: var(--text);
  line-height: 1.6;
}
.quote blockquote {
  margin: 0.3rem 0 0.2rem;
  padding-left: 0.7rem;
  border-left: 3px solid var(--accent);
  font-size: 0.92rem;
  color: var(--text);
  line-height: 1.7;
}
.rm-quote-date {
  font-size: 0.74rem;
  color: var(--text-3);
}
.rm-ach-row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.28rem 0.4rem;
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--text-2);
}
.rm-ach-row.on {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.rm-ach-meta {
  font-size: 0.76rem;
  color: var(--text-3);
}
.rm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.rm-chip {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 0.76rem;
  color: var(--text-3);
}
.rm-chip.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-text);
}
.rm-chip.custom {
  border-style: dashed;
}
.rm-tl-row {
  display: flex;
  gap: 0.7rem;
  font-size: 0.84rem;
  padding: 0.14rem 0;
}
.rm-tl-date {
  font-family: var(--font-num);
  color: var(--text-3);
  flex-shrink: 0;
}
.rm-dim {
  color: var(--text-3);
  font-size: 0.84rem;
}
.rm-foot {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 1.2rem 1rem;
  border-top: 1px solid var(--border);
  margin-top: 0.3rem;
}
.rm-btn {
  padding: 0.4rem 1rem;
  border: 2px solid var(--accent);
  border-radius: 11px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 0.9rem;
}
.rm-btn:hover {
  filter: brightness(1.05);
}
.rm-btn.ghost {
  background: var(--surface);
  color: var(--accent);
}
.rm-ok {
  margin-left: auto;
  color: var(--success);
  font-size: 0.82rem;
}
</style>
