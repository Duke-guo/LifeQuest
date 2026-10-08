<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
import GuideDrawer from './components/GuideDrawer.vue'
import GuideModal from './components/GuideModal.vue'
import { useTasksStore } from './stores/tasks'
import { useSettingsStore } from './stores/settings'
import { useJournalStore } from './stores/journal'
import { applyTheme } from './utils/theme'

type View =
  | 'tasks'
  | 'calendar'
  | 'notes'
  | 'journal'
  | 'plans'
  | 'seasons'
  | 'graph'
  | 'questmap'

const active = ref<View>('tasks')
const showSettings = ref(false)
const showGuide = ref(false)
const focusDate = ref<string | undefined>(undefined)

const tasksStore = useTasksStore()
const settingsStore = useSettingsStore()
const journalStore = useJournalStore()

onMounted(async () => {
  await settingsStore.load()
  applyTheme(settingsStore.settings?.theme)
  await tasksStore.load()
})

function switchView(key: string): void {
  focusDate.value = undefined
  active.value = key as View
}

async function openJournal(date: string): Promise<void> {
  await journalStore.load(date)
  focusDate.value = undefined
  active.value = 'journal'
}

function openCalendar(date: string): void {
  focusDate.value = date
  active.value = 'calendar'
}

function onTeleport(date: string, target: 'journal' | 'calendar'): void {
  if (target === 'journal') void openJournal(date)
  else openCalendar(date)
}
</script>

<template>
  <div class="app">
    <GuideDrawer @open-settings="showSettings = true" @open-guide="showGuide = true" />

    <main class="content">
      <TasksView v-if="active === 'tasks'" />
      <CalendarView
        v-else-if="active === 'calendar'"
        :focus-date="focusDate"
        @open-journal="openJournal"
      />
      <NotesView v-else-if="active === 'notes'" />
      <JournalView v-else-if="active === 'journal'" />
      <PlansView v-else-if="active === 'plans'" />
      <SeasonsView v-else-if="active === 'seasons'" />
      <GraphView v-else-if="active === 'graph'" />
      <QuestMapView v-else @teleport="onTeleport" />
    </main>

    <RadialMenu @select="switchView" />

    <GuideModal v-if="showGuide" @close="showGuide = false" />
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
  padding: 5rem 2rem 7rem;
}
</style>
