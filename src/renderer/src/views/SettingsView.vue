<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useUpdateStore } from '../stores/update'
import { dataApi } from '../services/data'
import { applyTheme, type Theme } from '../utils/theme'
import AppIcon from '../components/AppIcon.vue'
import type { Settings } from '../../../shared/types'

const emit = defineEmits<{ close: [] }>()

const store = useSettingsStore()
const dataRoot = ref('')
const exportMsg = ref('')
const aiSaved = ref('')
const updateStore = useUpdateStore()
const version = ref('')

const hasUpdate = computed(() => updateStore.state?.ok === true && updateStore.state.hasUpdate)
const latestVersion = computed(() => (updateStore.state?.ok ? updateStore.state.latest : ''))
const releaseUrl = computed(() => (updateStore.state?.ok ? updateStore.state.url : ''))
const updateMsg = computed(() => {
  const s = updateStore.state
  if (!s) return ''
  if (s.ok) return s.hasUpdate ? `发现新版 v${s.latest}（当前 v${s.current}）` : `已是最新版本（v${s.current}）`
  return s.error
})
const isUpdateError = computed(() => updateStore.state?.ok === false)

onMounted(async () => {
  await store.load()
  dataRoot.value = await dataApi.getRoot()
  version.value = await dataApi.getVersion()
  if (store.settings && !store.settings.ai) {
    store.settings.ai = {
      enabled: false,
      baseUrl: 'https://api.deepseek.com',
      apiKey: '',
      model: 'deepseek-chat'
    }
    await store.save()
  }
})

function ai(): NonNullable<Settings['ai']> | null {
  return store.settings?.ai ?? null
}

async function setTheme(theme: Theme): Promise<void> {
  if (!store.settings) return
  store.settings.theme = theme
  applyTheme(theme)
  await store.save()
}

async function toggleAnimations(): Promise<void> {
  if (!store.settings) return
  store.settings.animations.enabled = !store.settings.animations.enabled
  await store.save()
}

async function toggleGamification(): Promise<void> {
  if (!store.settings) return
  store.settings.gamification.enabled = !store.settings.gamification.enabled
  await store.save()
}

async function toggleAi(): Promise<void> {
  const a = ai()
  if (!a) return
  a.enabled = !a.enabled
  await store.save()
}

let aiSaveTimer: number | undefined

/** AI 设置：输入即自动保存，避免忘记点按钮导致丢失 */
function onAiInput(field: 'baseUrl' | 'apiKey' | 'model', value: string): void {
  const a = ai()
  if (!a) return
  a[field] = value
  if (aiSaveTimer) window.clearTimeout(aiSaveTimer)
  aiSaveTimer = window.setTimeout(async () => {
    await store.save()
    aiSaved.value = '已自动保存'
    window.setTimeout(() => (aiSaved.value = ''), 1800)
  }, 500)
}

async function doExport(): Promise<void> {
  const res = await dataApi.export()
  exportMsg.value = res.canceled ? '已取消' : `导出成功：${res.dest}`
}

async function checkUpdate(): Promise<void> {
  await updateStore.check()
}

async function openRelease(): Promise<void> {
  if (releaseUrl.value) await dataApi.openExternal(releaseUrl.value)
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="settings-card">
      <button class="close" @click="emit('close')"><AppIcon name="close" :size="20" /></button>
      <header class="view-head">
        <div>
          <h2>设置</h2>
          <p class="sub">本地优先 · 数据属于你</p>
        </div>
      </header>

      <section class="card" :class="{ highlight: hasUpdate }">
        <h3>
          版本与更新
          <span v-if="hasUpdate" class="new-dot" />
        </h3>
        <p class="row">
          当前版本：<code>v{{ version }}</code>
          <template v-if="hasUpdate"> · 新版 <code>v{{ latestVersion }}</code></template>
        </p>
        <div class="update-actions">
          <button class="btn" :disabled="updateStore.checking" @click="checkUpdate">
            {{ updateStore.checking ? '正在检查…' : '检查更新' }}
          </button>
          <button v-if="hasUpdate" class="btn alt" @click="openRelease">去 GitHub 下载</button>
        </div>
        <p v-if="updateMsg" class="msg" :class="{ err: isUpdateError }">{{ updateMsg }}</p>
      </section>

      <section class="card">
        <h3>外观</h3>
        <div class="theme-row">
          <button class="theme-opt" :class="{ on: store.settings?.theme !== 'dark' }" @click="setTheme('light')">
            明亮
          </button>
          <button class="theme-opt" :class="{ on: store.settings?.theme === 'dark' }" @click="setTheme('dark')">
            暗色
          </button>
        </div>
      </section>

      <section class="card">
        <h3>游戏化（轻 · 不焦虑）</h3>
        <label class="toggle">
          <input
            type="checkbox"
            :checked="store.settings?.gamification.enabled ?? true"
            @change="toggleGamification"
          />
          显示游戏化元素（成就 / 成长）
        </label>
        <label class="toggle">
          <input
            type="checkbox"
            :checked="store.settings?.animations.enabled ?? true"
            @change="toggleAnimations"
          />
          动画效果
        </label>
        <p class="hint">无排行榜、无连续打卡惩罚、无强制任务。</p>
      </section>

      <section class="card">
        <h3>AI 识图</h3>
        <label class="toggle">
          <input type="checkbox" :checked="ai()?.enabled ?? false" @change="toggleAi" />
          启用 AI 识图（在「任务」页上传截图自动生成任务）
        </label>
        <div class="field">
          <span>接口地址</span>
          <input
            :value="ai()?.baseUrl"
            placeholder="https://api.deepseek.com"
            @input="onAiInput('baseUrl', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field">
          <span>API Key</span>
          <input
            :value="ai()?.apiKey"
            type="password"
            placeholder="sk-..."
            @input="onAiInput('apiKey', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field">
          <span>模型</span>
          <input
            :value="ai()?.model"
            placeholder="deepseek-chat"
            @input="onAiInput('model', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <p class="hint">
          需要所用模型支持图片输入（vision）。Key 只保存在本地
          <code>config/settings.json</code>，不会上传到其它地方。
        </p>
        <div class="ai-actions">
          <span class="autosave">填写后自动保存，无需手动提交</span>
          <span v-if="aiSaved" class="msg">{{ aiSaved }}</span>
        </div>
      </section>

      <section class="card">
        <h3>数据</h3>
        <p class="row">数据位置：<code>{{ dataRoot }}</code></p>
        <p class="row hint">数据即普通文件（Markdown + JSON + 图片），可随时复制、备份、迁移。</p>
        <button class="btn" @click="doExport">导出数据（复制到指定文件夹）</button>
        <p v-if="exportMsg" class="msg">{{ exportMsg }}</p>
      </section>

    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 24, 30, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}
.settings-card {
  position: relative;
  width: min(560px, 92vw);
  max-height: 88vh;
  overflow-y: auto;
  background: var(--bg);
  border-radius: 20px;
  padding: 1.75rem;
  box-shadow: var(--shadow-lg);
}
.close {
  position: absolute;
  top: 14px;
  right: 14px;
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}
.close:hover {
  color: var(--text);
}
h3 {
  margin-bottom: 0.7rem;
  font-size: 1.05rem;
}
.theme-row {
  display: flex;
  gap: 0.5rem;
}
.theme-opt {
  padding: 0.5rem 1.4rem;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-2);
  font-weight: 600;
}
.theme-opt.on {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.field span {
  width: 74px;
  flex-shrink: 0;
  font-size: 0.82rem;
  color: var(--text-2);
}
.field input {
  flex: 1;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}
.row {
  margin: 0.4rem 0;
  word-break: break-all;
}
.btn {
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  margin-top: 0.5rem;
}
.ai-actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.autosave {
  font-size: 0.8rem;
  color: var(--text-3);
}
.msg {
  color: var(--success);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}
.msg.err {
  color: var(--danger);
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.btn.alt {
  background: var(--surface);
  color: var(--accent);
  border: 1px solid var(--accent);
}
.update-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.new-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-left: 6px;
  border-radius: 50%;
  background: var(--danger);
  vertical-align: middle;
}
.card.highlight {
  box-shadow: inset 3px 0 0 var(--danger);
}
.toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  cursor: pointer;
  font-size: 0.9rem;
}
.hint {
  color: var(--text-3);
  font-size: 0.82rem;
  margin-top: 0.5rem;
  line-height: 1.6;
}
</style>
