<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { useNotesStore } from '../stores/notes'
import { useTasksStore } from '../stores/tasks'
import { useTagsStore } from '../stores/tags'
import { useLinksStore } from '../stores/links'
import { dataApi } from '../services/data'
import AppIcon from '../components/AppIcon.vue'
import type { EntityRef } from '../../../shared/types'

const store = useNotesStore()
const tasksStore = useTasksStore()
const tagsStore = useTagsStore()
const linksStore = useLinksStore()

const title = ref('')
const category = ref('')
const rating = ref(3)
const theText = ref('')
const tagList = ref<string[]>([])
const tagInput = ref('')
const content = ref('')
const images = ref<string[]>([])
const imageSrcs = ref<Record<string, string>>({})
const previewSrc = ref('')
const linkHint = ref('')
const saving = ref(false)

const categoryOptions = computed(() => store.categories)

onMounted(async () => {
  await tagsStore.load()
  await linksStore.load()
  if (!tasksStore.loaded) await tasksStore.load()
  await store.list()
  if (store.notes.length > 0) select(store.notes[0].id)
})

async function select(id: string): Promise<void> {
  store.currentId = id
  const n = store.current
  if (!n) return
  title.value = n.title
  category.value = n.category
  rating.value = n.rating
  theText.value = n.theme.join(', ')
  tagList.value = [...n.tags]
  content.value = n.content
  images.value = [...n.images]
  await loadImageSrcs()
}

async function loadImageSrcs(): Promise<void> {
  const map: Record<string, string> = {}
  for (const f of images.value) {
    map[f] = await dataApi.readImage(f)
  }
  imageSrcs.value = map
}

function splitTags(s: string): string[] {
  return s
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

async function save(): Promise<void> {
  saving.value = true
  const tagIds: string[] = []
  for (const t of tagList.value) {
    const tag = await tagsStore.ensure(t, 'theme')
    tagIds.push(tag.id)
  }
  await store.saveCurrent({
    title: title.value.trim() || '未命名笔记',
    category: category.value.trim(),
    theme: splitTags(theText.value),
    rating: rating.value,
    tags: [...tagList.value],
    tagIds,
    images: [...images.value],
    content: content.value
  })
  saving.value = false
  linkHint.value = '已保存'
  window.setTimeout(() => (linkHint.value = ''), 2000)
}

async function create(): Promise<void> {
  await store.create()
  await select(store.currentId as string)
}

async function remove(id: string): Promise<void> {
  await store.remove(id)
  await linksStore.removeEntity({ kind: 'note', id })
  if (store.notes.length > 0) await select(store.notes[0].id)
}

// ---------- 图片（B11） ----------
async function onPickImages(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  for (const file of Array.from(input.files)) {
    const dataUrl = await fileToDataUrl(file)
    const name = await dataApi.saveImage(dataUrl)
    images.value.push(name)
  }
  input.value = ''
  await loadImageSrcs()
  await save()
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.readAsDataURL(file)
  })
}

async function onPaste(e: ClipboardEvent): Promise<void> {
  const items = e.clipboardData?.items
  if (!items) return
  for (const it of Array.from(items)) {
    if (it.type.startsWith('image/')) {
      const file = it.getAsFile()
      if (!file) continue
      const dataUrl = await fileToDataUrl(file)
      const name = await dataApi.saveImage(dataUrl)
      images.value.push(name)
    }
  }
  await loadImageSrcs()
  await save()
}

async function removeImage(name: string): Promise<void> {
  images.value = images.value.filter((x) => x !== name)
  await dataApi.deleteImage(name)
  await loadImageSrcs()
  await save()
}

// ---------- 标签 ----------
async function addTag(): Promise<void> {
  const v = tagInput.value.trim()
  if (!v) return
  if (!tagList.value.includes(v)) tagList.value.push(v)
  await tagsStore.ensure(v, 'theme')
  tagInput.value = ''
}

function removeTag(t: string): void {
  tagList.value = tagList.value.filter((x) => x !== t)
}

// ---------- 关联（B12） ----------
const linkTarget = ref('')

const linkOptions = computed(() => {
  const opts: Array<{ key: string; label: string }> = []
  for (const t of tasksStore.tasks) {
    opts.push({ key: `task:${t.id}`, label: `任务 · ${t.title}` })
  }
  for (const n of store.notes) {
    if (n.id === store.currentId) continue
    opts.push({ key: `note:${n.id}`, label: `笔记 · ${n.title}` })
  }
  return opts
})

const currentRef = computed<EntityRef | null>(() =>
  store.currentId ? { kind: 'note', id: store.currentId } : null
)

const linkedRefs = computed<EntityRef[]>(() => {
  const ref = currentRef.value
  if (!ref) return []
  return linksStore.connectedTo(ref)
})

function labelOf(ref: EntityRef): string {
  if (ref.kind === 'note') return `笔记 · ${store.byId(ref.id)?.title ?? ref.id}`
  if (ref.kind === 'task') return `任务 · ${tasksStore.tasks.find((t) => t.id === ref.id)?.title ?? ref.id}`
  return `${ref.kind} · ${ref.id}`
}

async function addLink(): Promise<void> {
  const ref = currentRef.value
  const v = linkTarget.value
  if (!ref || !v) return
  const [kind, id] = v.split(':')
  await linksStore.add(ref, { kind: kind as EntityRef['kind'], id })
  linkTarget.value = ''
}

async function removeLink(target: EntityRef): Promise<void> {
  const ref = currentRef.value
  if (!ref) return
  const found = linksStore.links.find(
    (l) =>
      (l.from.kind === ref.kind && l.from.id === ref.id && l.to.kind === target.kind && l.to.id === target.id) ||
      (l.to.kind === ref.kind && l.to.id === ref.id && l.from.kind === target.kind && l.from.id === target.id)
  )
  if (found) await linksStore.remove(found.id)
}

function onEditorClick(): void {
  // 保持焦点逻辑简单：图片粘贴监听挂在编辑器容器上
}
</script>

<template>
  <div class="notes-view" @paste="onPaste">
    <header class="view-head">
      <div>
        <h2>笔记</h2>
        <p class="sub">标题 · 分类 · 日期 · 标签 · 图片 · 关联</p>
      </div>
      <button class="new-btn" @click="create"><AppIcon name="plus" :size="16" /> 新建笔记</button>
    </header>

    <div class="notes-layout">
      <aside class="note-list">
        <div
          v-for="n in store.notes"
          :key="n.id"
          class="note-row"
          :class="{ active: n.id === store.currentId }"
          @click="select(n.id)"
        >
          <div class="note-title">{{ n.title }}</div>
          <div class="note-meta">
            <span>{{ n.category || '未分类' }}</span>
            <span class="stars">
              <AppIcon v-for="i in n.rating" :key="i" name="star" :size="10" />
            </span>
          </div>
          <div class="note-sub">
            <span v-if="n.images.length" class="badge"><AppIcon name="image" :size="11" />{{ n.images.length }}</span>
            <span v-if="n.tags.length" class="badge">{{ n.tags[0] }}<template v-if="n.tags.length > 1">+{{ n.tags.length - 1 }}</template></span>
          </div>
          <button class="del" title="删除" @click.stop="remove(n.id)">✕</button>
        </div>
        <div v-if="store.notes.length === 0" class="empty">还没有笔记，点右上角新建</div>
      </aside>

      <section v-if="store.current" class="note-editor">
        <!-- 分区 1：标题 -->
        <div class="sec">
          <input v-model="title" class="title-input" placeholder="笔记标题" />
        </div>

        <!-- 分区 2：元信息 -->
        <div class="sec meta-sec">
          <label class="field">
            <span>分类</span>
            <input v-model="category" list="cat-list" placeholder="如：数学" />
            <datalist id="cat-list">
              <option v-for="c in categoryOptions" :key="c" :value="c"></option>
            </datalist>
          </label>
          <label class="field">
            <span>日期</span>
            <input :value="store.current.date" disabled />
          </label>
          <label class="field">
            <span>评价</span>
            <select v-model="rating">
              <option :value="5">5 分</option>
              <option :value="4">4 分</option>
              <option :value="3">3 分</option>
              <option :value="2">2 分</option>
              <option :value="1">1 分</option>
            </select>
          </label>
          <label class="field grow">
            <span>主题</span>
            <input v-model="theText" placeholder="如：极限, 导数" />
          </label>
        </div>

        <!-- 分区 3：标签 -->
        <div class="sec tag-sec">
          <span class="sec-label">标签</span>
          <span v-for="t in tagList" :key="t" class="tag-chip" :style="{ '--c': tagsStore.colorOf(t) }">
            {{ t }}
            <button class="tag-x" @click="removeTag(t)">✕</button>
          </span>
          <input v-model="tagInput" class="tag-input" placeholder="加标签后回车" @keyup.enter="addTag" />
        </div>

        <!-- 分区 4：图片 -->
        <div class="sec img-sec">
          <div class="sec-head">
            <span class="sec-label">图片</span>
            <label class="upload-btn">
              <AppIcon name="camera" :size="15" /> 添加图片
              <input type="file" accept="image/*" multiple hidden @change="onPickImages" />
            </label>
            <span class="hint">也可直接 Ctrl+V 粘贴截图</span>
          </div>
          <div v-if="images.length" class="gallery">
            <div v-for="f in images" :key="f" class="thumb">
              <img :src="imageSrcs[f]" :alt="f" @click="previewSrc = imageSrcs[f]" />
              <button class="thumb-x" @click="removeImage(f)">✕</button>
            </div>
          </div>
          <div v-else class="none">还没有图片</div>
        </div>

        <!-- 分区 5：正文 -->
        <div class="sec">
          <span class="sec-label">正文</span>
          <textarea
            v-model="content"
            class="content-input"
            placeholder="笔记正文（支持 Markdown）…"
            @click="onEditorClick"
          ></textarea>
        </div>

        <!-- 分区 6：关联 -->
        <div class="sec link-sec">
          <span class="sec-label">关联</span>
          <span v-for="r in linkedRefs" :key="`${r.kind}-${r.id}`" class="link-chip">
            {{ labelOf(r) }}
            <button class="tag-x" @click="removeLink(r)">✕</button>
          </span>
          <select v-model="linkTarget" class="link-select" @change="addLink">
            <option value="">＋ 关联到…</option>
            <option v-for="o in linkOptions" :key="o.key" :value="o.key">{{ o.label }}</option>
          </select>
        </div>

        <div class="actions">
          <span v-if="linkHint" class="saved">{{ linkHint }}</span>
          <button class="save-btn" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </section>
    </div>

    <div v-if="previewSrc" class="preview" @click="previewSrc = ''">
      <img :src="previewSrc" alt="preview" />
    </div>
  </div>
</template>

<style scoped>
.new-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}
.notes-layout {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}
.note-list {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.note-row {
  position: relative;
  padding: 0.6rem 0.75rem;
  background: var(--surface);
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform 0.15s ease;
}
.note-row:hover {
  transform: translateY(-1px);
}
.note-row.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.note-title {
  font-weight: 600;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-meta {
  font-size: 0.75rem;
  color: var(--text-2);
  margin-top: 0.2rem;
  display: flex;
  justify-content: space-between;
}
.stars {
  display: inline-flex;
  gap: 1px;
  color: var(--accent);
}
.note-sub {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.25rem;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.68rem;
  background: var(--surface-2);
  color: var(--text-2);
  border-radius: 6px;
  padding: 1px 5px;
}
.del {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.8rem;
}
.del:hover {
  color: var(--danger);
}
.note-editor {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.sec {
  background: var(--surface);
  border-radius: 12px;
  padding: 0.85rem;
  box-shadow: var(--shadow);
}
.sec-label {
  font-size: 0.78rem;
  color: var(--text-3);
  margin-right: 0.4rem;
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}
.title-input {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: none;
  border-bottom: 2px solid var(--border);
  background: none;
  color: var(--text);
  font-size: 1.15rem;
  font-weight: 600;
  outline: none;
}
.title-input:focus {
  border-color: var(--accent);
}
.meta-sec {
  display: flex;
  gap: 0.9rem;
  flex-wrap: wrap;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-3);
}
.field.grow {
  flex: 1;
  min-width: 140px;
}
.field input,
.field select {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
}
.field input:disabled {
  color: var(--text-3);
}
.tag-sec,
.link-sec {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 10px;
  padding: 2px 6px 2px 9px;
  font-size: 0.8rem;
  color: #fff;
  background: var(--c, var(--text-3));
}
.link-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--surface-2);
  color: var(--text-2);
  border-radius: 10px;
  padding: 2px 6px 2px 9px;
  font-size: 0.78rem;
}
.tag-x {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0 2px;
}
.tag-input {
  border: none;
  border-bottom: 1px dashed var(--border);
  background: none;
  color: var(--text);
  padding: 0.25rem 0.2rem;
  font-size: 0.85rem;
  outline: none;
}
.link-select {
  border: 1px dashed var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 8px;
  padding: 0.25rem 0.4rem;
  font-size: 0.8rem;
}
.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  cursor: pointer;
  color: var(--text-2);
}
.upload-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.hint {
  font-size: 0.75rem;
  color: var(--text-3);
}
.gallery {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.thumb {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.thumb:hover {
  transform: scale(1.04);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-x {
  position: absolute;
  top: 2px;
  right: 2px;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 0.65rem;
  cursor: pointer;
}
.none {
  color: var(--text-3);
  font-size: 0.82rem;
}
.content-input {
  width: 100%;
  min-height: 34vh;
  margin-top: 0.5rem;
  padding: 0.9rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  line-height: 1.7;
  resize: vertical;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.8rem;
}
.saved {
  color: var(--success);
  font-size: 0.85rem;
}
.save-btn {
  padding: 0.55rem 1.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}
.preview {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  cursor: zoom-out;
}
.preview img {
  max-width: 88vw;
  max-height: 88vh;
  border-radius: 12px;
}
</style>
