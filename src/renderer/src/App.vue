<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TasksView from './views/TasksView.vue'
import CalendarView from './views/CalendarView.vue'
import NotesView from './views/NotesView.vue'
import JournalView from './views/JournalView.vue'
import PlansView from './views/PlansView.vue'
import SeasonsView from './views/SeasonsView.vue'
import SettingsView from './views/SettingsView.vue'
import RadialMenu from './components/RadialMenu.vue'
import GuideDrawer from './components/GuideDrawer.vue'
import GuideModal from './components/GuideModal.vue'
import { useTasksStore } from './stores/tasks'
import { useSettingsStore } from './stores/settings'
import { applyTheme } from './utils/theme'

type View = 'tasks' | 'calendar' | 'notes' | 'journal' | 'plans' | 'seasons'

const active = ref<View>('tasks')
const showSettings = ref(false)
const showGuide = ref(false)
const tasksStore = useTasksStore()
const settingsStore = useSettingsStore()

onMounted(async () => {
  await settingsStore.load()
  applyTheme(settingsStore.settings?.theme)
  await tasksStore.load()
})

function switchView(key: string): void {
  active.value = key as View
}
</script>

<template>
  <div class="app">
    <GuideDrawer @open-settings="showSettings = true" @open-guide="showGuide = true" />

    <main class="content">
      <TasksView v-if="active === 'tasks'" />
      <CalendarView v-else-if="active === 'calendar'" />
      <NotesView v-else-if="active === 'notes'" />
      <JournalView v-else-if="active === 'journal'" />
      <PlansView v-else-if="active === 'plans'" />
      <SeasonsView v-else />
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
  max-width: 1080px;
  margin: 0 auto;
  padding: 5rem 2rem 7rem;
}
</style>
