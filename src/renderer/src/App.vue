<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import HomeView from './views/HomeView.vue'
import TasksView from './views/TasksView.vue'
import CalendarView from './views/CalendarView.vue'
import NotesView from './views/NotesView.vue'
import JournalView from './views/JournalView.vue'
import PlansView from './views/PlansView.vue'
import SeasonsView from './views/SeasonsView.vue'
import GraphView from './views/GraphView.vue'
import QuestMapView from './views/QuestMapView.vue'
import SettingsView from './views/SettingsView.vue'
import RadialMenu from './components/RadialMenu.vue'
import TitleBar from './components/TitleBar.vue'
import GuideDrawer from './components/GuideDrawer.vue'
import GuideModal from './components/GuideModal.vue'
import HelpModal from './components/HelpModal.vue'
import ReminderBanner from './components/ReminderBanner.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import AppIcon from './components/AppIcon.vue'
import { HELPS } from './utils/helps'
import { hasDemo, loadDemo, clearDemo } from './utils/demoData'
import { useTasksStore } from './stores/tasks'
import { useSettingsStore } from './stores/settings'
import { useJournalStore } from './stores/journal'
import { useNotesStore } from './stores/notes'
import { useJournalIndexStore } from './stores/journalIndex'
import { useSemesterStore } from './stores/semester'
import { useSeasonsStore } from './stores/seasons'
import { useGamificationStore } from './stores/gamification'
import { useConfirmStore } from './stores/confirm'
import { applyTheme } from './utils/theme'

type View =
  | 'home'
  | 'tasks'
  | 'calendar'
  | 'notes'
  | 'journal'
  | 'plans'
  | 'seasons'
  | 'graph'
  | 'questmap'

const VIEW_NAMES: Record<View, string> = {
  home: '首页',
  tasks: '任务',
  calendar: '日历',
  notes: '笔记',
  journal: '日记',
  plans: '计划',
  seasons: '赛季',
  graph: '知识地图',
  questmap: '主线地图'
}

const active = ref<View>('home')
/** 浏览历史，供“返回”使用；最多保留 30 步 */
const backStack = ref<View[]>([])
const showSettings = ref(false)
const showGuide = ref(false)
const focusDate = ref<string | undefined>(undefined)
/** 跳到日历时落在哪个视图：任务定位看周、日记/地图传送看天 */
const focusMode = ref<'day' | 'week'>('week')
/** 定位过去后要高亮闪几下的任务 */
const focusTaskId = ref<string | undefined>(undefined)

const tasksStore = useTasksStore()
const settingsStore = useSettingsStore()
const journalStore = useJournalStore()
const notesStore = useNotesStore()
const journalIndex = useJournalIndexStore()
const semesterStore = useSemesterStore()
const seasonsStore = useSeasonsStore()
const gStore = useGamificationStore()
const confirm = useConfirmStore()

const canGoBack = computed(() => backStack.value.length > 0)
const backTarget = computed(() =>
  backStack.value.length ? VIEW_NAMES[backStack.value[backStack.value.length - 1]] : ''
)

/** 每页「?」说明 */
const showHelp = ref(false)
/** 是否已载入示例数据 */
const hasDemoData = ref(false)

onMounted(async () => {
  await settingsStore.load()
  applyTheme(settingsStore.settings?.theme)
  await tasksStore.load()
  hasDemoData.value = await hasDemo()
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => window.removeEventListener('keydown', onKey))

function pushHistory(): void {
  backStack.value.push(active.value)
  if (backStack.value.length > 30) backStack.value.shift()
}

/** 切到某个视图；record=false 用于“返回”自身 */
function go(key: View, record = true): void {
  if (key === active.value) return
  if (record) pushHistory()
  focusDate.value = undefined
  active.value = key
}

function switchView(key: string): void {
  go(key as View)
}

function goBack(): void {
  const prev = backStack.value.pop()
  if (!prev) return
  focusDate.value = undefined
  active.value = prev
}

function onKey(e: KeyboardEvent): void {
  // Alt + ← / Ctrl + ← 返回上一页
  if ((e.altKey || e.ctrlKey) && e.key === 'ArrowLeft') {
    e.preventDefault()
    goBack()
  }
}

async function openJournal(date: string): Promise<void> {
  await journalStore.load(date)
  if (active.value !== 'journal') pushHistory()
  focusDate.value = undefined
  active.value = 'journal'
}

function openCalendar(date: string, mode: 'day' | 'week' = 'day', taskId?: string): void {
  if (active.value !== 'calendar') pushHistory()
  focusDate.value = date
  focusMode.value = mode
  focusTaskId.value = taskId
  active.value = 'calendar'
}

/** 从任务/日历/首页一键写笔记后跳到笔记页并选中这篇 */
function openNote(noteId: string): void {
  notesStore.currentId = noteId
  go('notes')
}

function onTeleport(date: string, target: 'journal' | 'calendar'): void {
  if (target === 'journal') void openJournal(date)
  else openCalendar(date)
}

/** 示例数据载入/清空后，把各 store 重新读一遍，当前页面立刻跟着变 */
async function reloadAll(): Promise<void> {
  await Promise.all([
    tasksStore.load(),
    journalIndex.load(),
    semesterStore.load(),
    seasonsStore.load(),
    notesStore.list(),
    gStore.refresh()
  ])
}

async function toggleDemo(): Promise<void> {
  if (hasDemoData.value) {
    const ok = await confirm.ask({
      title: '清空示例数据？',
      message: '只会删掉带「示例」前缀的内容',
      detail: '示例赛季、任务、计划、笔记、日记会一起移除；你自己加的东西不受影响。',
      confirmText: '清空示例'
    })
    if (!ok) return
    await clearDemo()
  } else {
    await loadDemo()
  }
  await reloadAll()
  hasDemoData.value = await hasDemo()
}
</script>

<template>
  <div class="app">
    <TitleBar :view-name="VIEW_NAMES[active]" @help="showHelp = true" />
    <GuideDrawer :has-demo="hasDemoData" @open-settings="showSettings = true" @open-guide="showGuide = true" @toggle-demo="toggleDemo" />

    <main class="content">
      <transition name="back-fade">
        <button v-if="canGoBack" class="back-btn" :title="`回到${backTarget}`" @click="goBack">
          <AppIcon name="back" :size="17" />
          <span>返回{{ backTarget }}</span>
        </button>
      </transition>

      <HomeView
        v-if="active === 'home'"
        @navigate="switchView"
        @open-journal="openJournal"
        @open-note="openNote"
        @open-calendar="openCalendar"
      />
      <TasksView
        v-else-if="active === 'tasks'"
        @open-note="openNote"
        @open-calendar="openCalendar"
      />
      <CalendarView
        v-else-if="active === 'calendar'"
        :focus-date="focusDate"
        :focus-mode="focusMode"
        :focus-task-id="focusTaskId"
        @open-journal="openJournal"
        @open-note="openNote"
        @open-calendar="openCalendar"
      />
      <NotesView v-else-if="active === 'notes'" />
      <JournalView v-else-if="active === 'journal'" @open-note="openNote" />
      <PlansView v-else-if="active === 'plans'" />
      <SeasonsView v-else-if="active === 'seasons'" />
      <GraphView v-else-if="active === 'graph'" @open-note="openNote" />
      <QuestMapView v-else @teleport="onTeleport" />
    </main>

    <RadialMenu @select="switchView" />

    <ReminderBanner />

    <!-- 全局确认框：删除等破坏性操作都会走它 -->
    <ConfirmDialog />

    <GuideModal v-if="showGuide" :has-demo="hasDemoData" @close="showGuide = false" @demo="toggleDemo" />
    <HelpModal v-if="showHelp" :help="HELPS[active]" @close="showHelp = false" />
    <SettingsView v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
}
.content {
  max-width: 1120px;
  margin: 0 auto;
  /* 顶部留出自绘标题栏（38px）的高度 */
  padding: 4.6rem 2rem 7rem;
}
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 1.1rem;
  padding: 0.34rem 0.85rem 0.34rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 0.82rem;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    transform 0.15s;
}
.back-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: translateX(-2px);
}
.back-fade-enter-active,
.back-fade-leave-active {
  transition: opacity 0.18s ease;
}
.back-fade-enter-from,
.back-fade-leave-to {
  opacity: 0;
}
</style>
