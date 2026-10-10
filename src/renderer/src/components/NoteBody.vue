<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { renderMarkdown, type ImageResolver } from '../utils/markdown'

/**
 * 「所写即所见」的正文编辑：整篇始终按 Markdown 渲染，
 * 点某一段就在原地把它变回源码编辑，其余段落保持渲染（类似 Obsidian 的实时预览）。
 */
const props = defineProps<{
  modelValue: string
  resolveImage?: ImageResolver
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

interface Block {
  key: number
  start: number
  end: number
  text: string
}

/** 按空行切块（``` 代码块内部不切），同时记下字符区间用于回写 */
function splitBlocks(src: string): Block[] {
  const out: Block[] = []
  const lines: Array<{ text: string; start: number; end: number }> = []
  let off = 0
  for (const l of src.split('\n')) {
    lines.push({ text: l, start: off, end: off + l.length })
    off += l.length + 1
  }
  let i = 0
  while (i < lines.length) {
    if (!lines[i].text.trim()) {
      i++
      continue
    }
    const start = lines[i].start
    let end = lines[i].end
    let inFence = /^\s*```/.test(lines[i].text)
    i++
    if (inFence) {
      while (i < lines.length) {
        end = lines[i].end
        const closing = /^\s*```/.test(lines[i].text)
        i++
        if (closing) break
      }
    } else {
      while (i < lines.length && lines[i].text.trim()) {
        end = lines[i].end
        i++
      }
    }
    out.push({ key: out.length, start, end, text: src.slice(start, end) })
  }
  return out
}

const blocks = computed(() => splitBlocks(props.modelValue))

/** 正在编辑的块；-1 表示末尾的「新段落」 */
const editing = ref<number | null>(null)
const draft = ref('')
/** 同一时刻只会有一个输入框，按根节点查比用 ref 稳（v-for 里的 ref 会变成数组） */
const rootRef = ref<HTMLElement | null>(null)

function currentTa(): HTMLTextAreaElement | null {
  return rootRef.value?.querySelector<HTMLTextAreaElement>('.nb-input') ?? null
}

const rows = computed(() => Math.max(1, draft.value.split('\n').length))

function html(text: string): string {
  return renderMarkdown(text, props.resolveImage)
}

async function startEdit(index: number): Promise<void> {
  editing.value = index
  draft.value = index === -1 ? '' : (blocks.value[index]?.text ?? '')
  await nextTick()
  const ta = currentTa()
  if (!ta) return
  ta.focus()
  const len = ta.value.length
  ta.setSelectionRange(len, len)
  autoGrow()
}

function autoGrow(): void {
  const ta = currentTa()
  if (!ta) return
  ta.style.height = 'auto'
  ta.style.height = `${ta.scrollHeight}px`
}

function onInput(): void {
  autoGrow()
}

/** 提交：把这一块的新文本拼回整篇 */
function commit(): void {
  const idx = editing.value
  if (idx === null) return
  const text = draft.value
  if (idx === -1) {
    if (text.trim()) {
      const sep = props.modelValue.trim() ? props.modelValue.replace(/\s+$/, '') + '\n\n' : ''
      emit('update:modelValue', sep + text)
    }
  } else {
    const b = blocks.value[idx]
    if (b) {
      const next = props.modelValue.slice(0, b.start) + text + props.modelValue.slice(b.end)
      if (next !== props.modelValue) emit('update:modelValue', next)
    }
  }
  editing.value = null
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
    e.preventDefault()
    commit()
  }
}

/** 删掉整段 */
function removeBlock(index: number, e: Event): void {
  e.stopPropagation()
  const b = blocks.value[index]
  if (!b) return
  const before = props.modelValue.slice(0, b.start).replace(/\s+$/, '')
  const after = props.modelValue.slice(b.end).replace(/^\s+/, '')
  const next = before && after ? `${before}\n\n${after}` : before + after
  emit('update:modelValue', next)
  if (editing.value === index) editing.value = null
}

/** - [ ] 清单：点复选框就切换打勾，并把源文改成 - [x] / - [ ] */
function toggleTaskCheckbox(text: string, idx: number): string {
  let seen = 0
  return text.replace(/\[([ xX])\]/g, (m, c: string) => {
    if (seen++ === idx) return c.toLowerCase() === 'x' ? '[ ]' : '[x]'
    return m
  })
}

function onRootClick(e: MouseEvent): void {
  const t = e.target as HTMLElement
  if (t.tagName !== 'INPUT') return
  const box = t as HTMLInputElement
  const blockEl = box.closest('.nb-block') as HTMLElement | null
  if (!blockEl || blockEl.dataset.idx === undefined) return
  const bi = Number(blockEl.dataset.idx)
  const b = blocks.value[bi]
  if (!b) return
  const ti = Number(box.dataset.taskIdx ?? 0)
  const nextText = toggleTaskCheckbox(b.text, ti)
  if (nextText === b.text) return
  const next = props.modelValue.slice(0, b.start) + nextText + props.modelValue.slice(b.end)
  emit('update:modelValue', next)
}
</script>

<template>
  <div ref="rootRef" class="nb" @click="onRootClick">
    <div
      v-for="(b, i) in blocks"
      :key="b.key"
      :data-idx="i"
      class="nb-block"
      :class="{ editing: editing === i }"
    >
      <textarea
        v-if="editing === i"
        v-model="draft"
        class="nb-input"
        :rows="rows"
        spellcheck="false"
        @input="onInput"
        @blur="commit"
        @keydown="onKeydown"
      ></textarea>
      <template v-else>
        <div class="md-body nb-render" v-html="html(b.text)" @click="startEdit(i)"></div>
        <button class="nb-del" title="删除这一段" @click="removeBlock(i, $event)">✕</button>
      </template>
    </div>

    <!-- 末尾：点一下就接着写 -->
    <div class="nb-block nb-tail" :class="{ editing: editing === -1 }">
      <textarea
        v-if="editing === -1"
        v-model="draft"
        class="nb-input"
        :rows="rows"
        spellcheck="false"
        @input="onInput"
        @blur="commit"
        @keydown="onKeydown"
      ></textarea>
      <div v-else class="nb-add" @click="startEdit(-1)">
        {{ blocks.length ? '＋ 接着写…' : placeholder || '＋ 开始写…' }}
      </div>
    </div>

    <p class="nb-hint">
      点任意一段直接在原地改（改的是 Markdown 源码），Esc 或 Ctrl+Enter 结束这一段；其余段落保持渲染。
    </p>
  </div>
</template>

<style scoped>
.nb {
  min-height: 34vh;
  margin-top: 0.5rem;
  padding: 0.9rem 1rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.nb-block {
  position: relative;
  border-radius: 8px;
  transition: background-color 0.14s ease;
}
.nb-block:not(.editing):hover {
  background: var(--surface-2);
}
.nb-render {
  padding: 1px 6px;
  cursor: text;
}
/* 编辑态：和渲染态尽量同字号同行高，切换不跳 */
.nb-input {
  display: block;
  width: 100%;
  padding: 1px 6px;
  border: none;
  outline: none;
  background: none;
  color: var(--text);
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 0.86rem;
  line-height: 1.75;
  resize: none;
  overflow: hidden;
  border-left: 2px solid var(--accent);
  border-radius: 4px;
}
.nb-del {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.72rem;
  opacity: 0;
  transition: opacity 0.14s ease, color 0.14s ease, background-color 0.14s ease;
}
.nb-block:hover .nb-del {
  opacity: 1;
}
.nb-del:hover {
  color: var(--danger);
  background: var(--surface);
}
.nb-add {
  padding: 0.35rem 6px;
  color: var(--text-3);
  font-size: 0.85rem;
  cursor: text;
  border-radius: 8px;
}
.nb-add:hover {
  background: var(--surface-2);
  color: var(--accent);
}
.nb-hint {
  margin: 0.6rem 0 0.2rem;
  font-size: 0.72rem;
  color: var(--text-3);
  line-height: 1.6;
}
</style>
