<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useNotesStore } from '../stores/notes'

const store = useNotesStore()
const title = ref('')
const themeText = ref('')
const rating = ref(3)
const tagsText = ref('')
const content = ref('')

onMounted(async () => {
  await store.list()
  if (store.notes.length > 0) select(store.notes[0].id)
})

function select(id: string): void {
  store.currentId = id
  const n = store.current
  if (!n) return
  title.value = n.title
  themeText.value = n.theme.join(', ')
  rating.value = n.rating
  tagsText.value = n.tags.join(', ')
  content.value = n.content
}

function splitTags(s: string): string[] {
  return s
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

async function save(): Promise<void> {
  await store.saveCurrent({
    title: title.value.trim() || '未命名笔记',
    theme: splitTags(themeText.value),
    rating: rating.value,
    tags: splitTags(tagsText.value),
    content: content.value
  })
}

async function create(): Promise<void> {
  await store.create()
  select(store.currentId as string)
}

async function remove(id: string): Promise<void> {
  await store.remove(id)
  if (store.notes.length > 0) select(store.notes[0].id)
}
</script>

<template>
  <div class="notes-view">
    <header class="view-head">
      <div>
        <h2>笔记</h2>
        <p class="sub">日期 · 主题 · 评价 三类标签</p>
      </div>
      <button class="new-btn" @click="create">＋ 新建笔记</button>
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
            <span>{{ n.date }}</span>
            <span class="stars">{{ '★'.repeat(n.rating) }}</span>
          </div>
          <button class="del" title="删除" @click.stop="remove(n.id)">✕</button>
        </div>
        <div v-if="store.notes.length === 0" class="empty">还没有笔记，点右上角新建</div>
      </aside>

      <section v-if="store.current" class="note-editor">
        <input v-model="title" class="title-input" placeholder="笔记标题" />
        <div class="meta-row">
          <label>
            主题
            <input v-model="themeText" placeholder="如：学习, 高数" />
          </label>
          <label>
            评价
            <select v-model="rating">
              <option :value="5">★★★★★</option>
              <option :value="4">★★★★</option>
              <option :value="3">★★★</option>
              <option :value="2">★★</option>
              <option :value="1">★</option>
            </select>
          </label>
          <label>
            标签
            <input v-model="tagsText" placeholder="如：重点, 待复习" />
          </label>
        </div>
        <textarea
          v-model="content"
          class="content-input"
          placeholder="笔记正文（支持 Markdown）…"
        ></textarea>
        <div class="actions">
          <button class="save-btn" @click="save">保存</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.new-btn {
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
  color: var(--accent);
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
  gap: 0.75rem;
}
.title-input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 1.05rem;
  font-weight: 600;
  background: var(--surface);
  color: var(--text);
}
.meta-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
.meta-row label {
  font-size: 0.85rem;
  color: var(--text-2);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.meta-row input {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}
.meta-row select {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}
.content-input {
  width: 100%;
  min-height: 48vh;
  padding: 0.9rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  line-height: 1.7;
  resize: vertical;
}
.actions {
  display: flex;
  justify-content: flex-end;
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
</style>
