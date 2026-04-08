<template>
  <div class="notes-panel">
    <div class="notes-sidebar">
      <div class="notes-list-header">
        <span class="notes-list-title">笔记</span>
        <button class="btn-new" @click="createNote" :disabled="creating" title="新建">+</button>
      </div>
      <div class="notes-search">
        <input v-model="search" type="text" placeholder="搜索..." />
      </div>
      <div class="notes-list-items">
        <div v-if="loading" class="list-hint">加载中...</div>
        <div v-else-if="filteredNotes.length === 0" class="list-hint">
          {{ search ? '没有匹配' : '点 + 新建' }}
        </div>
        <div
          v-for="note in filteredNotes"
          :key="note.key"
          class="note-item"
          :class="{ active: selected?.key === note.key }"
          @click="selectNote(note)"
        >
          <span class="note-icon">📖</span>
          <div class="note-info">
            <div class="note-name">{{ note.name }}</div>
            <div class="note-date">{{ formatDate(note.lastModified) }}</div>
          </div>
          <button class="note-delete" @click.stop="removeNote(note)" title="删除">🗑</button>
        </div>
      </div>
    </div>

    <div class="notes-editor">
      <div v-if="!selected" class="editor-empty">
        <div class="empty-icon">📝</div>
        <p>选择一个笔记开始编辑</p>
      </div>
      <template v-else>
        <div class="editor-toolbar">
          <button class="tbtn" @click="insertMd('**','**')" title="加粗">B</button>
          <button class="tbtn" @click="insertMd('_','_')" title="斜体"><em>I</em></button>
          <div class="tsep" />
          <button class="tbtn" @click="insertMd('## ','')" title="H1">H1</button>
          <button class="tbtn" @click="insertMd('### ','')" title="H2">H2</button>
          <div class="tsep" />
          <button class="tbtn" @click="insertMd('`','`')" title="代码">&lt;/&gt;</button>
          <button class="tbtn" @click="insertMd('- ','')" title="列表">•</button>
          <div class="tsep" />
          <button class="tbtn" :class="{ active: preview }" @click="preview = !preview" title="预览">👁</button>
          <div style="flex:1" />
          <span class="save-status">{{ saveStatus }}</span>
        </div>
        <div class="editor-title">
          <input v-model="selected.name" type="text" readonly />
        </div>
        <div class="editor-body">
          <textarea
            v-if="!preview"
            ref="ta"
            v-model="content"
            @input="onContentChange"
            placeholder="开始写作..."
            spellcheck="false"
          />
          <div v-else class="editor-preview" v-html="renderedMd" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { listNotes, getNote, saveNote, deleteNote } from '../api/index.js'

const props = defineProps({ selectedKey: String })
const emit = defineEmits(['select'])

const notes = ref([])
const selected = ref(null)
const content = ref('')
const search = ref('')
const loading = ref(true)
const creating = ref(false)
const preview = ref(false)
const saveStatus = ref('')
const ta = ref(null)

let saveTimer = null

const filteredNotes = computed(() =>
  notes.value.filter(n => n.name.toLowerCase().includes(search.value.toLowerCase()))
)

onMounted(loadNotes)

async function loadNotes() {
  try { notes.value = await listNotes() }
  catch (e) { console.error('加载失败', e) }
  finally { loading.value = false }
}

async function selectNote(note) {
  selected.value = { ...note }
  content.value = await getNote(note.key)
  preview.value = false
  emit('select', note.key)
}

async function createNote() {
  if (creating.value) return
  creating.value = true
  try {
    const ts = Date.now().toString(36)
    const name = '未命名-' + ts
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content: '# ' + name + '\n\n' }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    const result = await res.json()
    await loadNotes()
    await selectNote({ key: result.key, name })
  } catch (e) { console.error('创建失败', e) }
  finally { creating.value = false }
}

async function removeNote(note) {
  if (!confirm('删除这篇笔记？')) return
  try {
    await deleteNote(note.key)
    if (selected.value?.key === note.key) selected.value = null
    await loadNotes()
  } catch (e) { console.error('删除失败', e) }
}

function onContentChange() {
  if (!selected.value) return
  clearTimeout(saveTimer)
  saveStatus.value = ''
  saveTimer = setTimeout(doSave, 1500)
}

async function doSave() {
  if (!selected.value) return
  try {
    saveStatus.value = '保存中...'
    await saveNote(selected.value.key, content.value)
    saveStatus.value = '已保存'
    setTimeout(() => { saveStatus.value = '' }, 2000)
  } catch (e) {
    saveStatus.value = '保存失败'
    console.error(e)
  }
}

function insertMd(before, after) {
  after = after || ''
  const el = ta.value
  if (!el) return
  const s = el.selectionStart, e = el.selectionEnd
  const sel = content.value.slice(s, e)
  content.value = content.value.slice(0, s) + before + sel + after + content.value.slice(e)
  nextTick(() => {
    el.focus()
    el.setSelectionRange(s + before.length, s + before.length + sel.length)
  })
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const renderedMd = computed(() => {
  return content.value
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>')
})
</script>

<style scoped>
.notes-panel { display: flex; height: 100%; background: var(--bg-surface); }
.notes-sidebar { width: 240px; border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.notes-list-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.notes-list-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.btn-new { width: 26px; height: 26px; border-radius: var(--radius-sm); background: var(--accent); color: #11111b; font-size: 18px; line-height: 1; font-weight: 700; }
.btn-new:hover { background: var(--accent-hover); }
.btn-new:disabled { opacity: .5; }
.notes-search { padding: 8px; border-bottom: 1px solid var(--border); }
.notes-search input { width: 100%; font-size: 12px; }
.notes-list-items { flex: 1; overflow-y: auto; padding: 4px 0; }
.list-hint { padding: 12px; color: var(--muted); font-size: 12px; text-align: center; }
.note-item { display: flex; align-items: center; padding: 8px 12px; cursor: pointer; gap: 8px; transition: background .1s; }
.note-item:hover { background: var(--bg-overlay); }
.note-item.active { background: var(--bg-overlay); border-left: 2px solid var(--accent); }
.note-item .note-icon { color: var(--accent); flex-shrink: 0; }
.note-item .note-info { flex: 1; min-width: 0; }
.note-item .note-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.note-item.active .note-name { color: var(--accent); font-weight: 500; }
.note-item .note-date { font-size: 11px; color: var(--muted); }
.note-item .note-delete { opacity: 0; width: 22px; height: 22px; border-radius: var(--radius-sm); background: transparent; color: var(--muted); display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.note-item:hover .note-delete { opacity: 1; }
.note-item .note-delete:hover { background: var(--red); color: #fff; }
.notes-editor { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.editor-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--muted); }
.empty-icon { font-size: 48px; opacity: .4; }
.editor-empty p { font-size: 13px; }
.editor-toolbar { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.tbtn { width: 28px; height: 28px; border-radius: var(--radius-sm); background: transparent; color: var(--muted); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.tbtn:hover { background: var(--bg-overlay); color: var(--text); }
.tbtn.active { color: var(--accent); }
.tsep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
.save-status { font-size: 11px; color: var(--green); }
.editor-title { padding: 10px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.editor-title input { width: 100%; background: transparent; border: none; font-size: 16px; font-weight: 600; color: var(--text); padding: 0; }
.editor-title input:focus { outline: none; }
.editor-body { flex: 1; overflow: hidden; display: flex; }
.editor-body textarea { flex: 1; padding: 16px 20px; font-family: monospace; font-size: 14px; line-height: 1.8; background: transparent; border: none; color: var(--text); }
.editor-body textarea:focus { outline: none; }
.editor-preview { flex: 1; padding: 16px 20px; overflow-y: auto; font-size: 14px; line-height: 1.8; }
.editor-preview :deep(h1) { color: var(--accent-hover); font-size: 1.6em; margin: .6em 0 .3em; }
.editor-preview :deep(h2) { color: var(--accent-hover); font-size: 1.3em; margin: .6em 0 .3em; }
.editor-preview :deep(h3) { color: var(--accent-hover); font-size: 1.1em; margin: .6em 0 .3em; }
.editor-preview :deep(p) { margin: .5em 0; }
.editor-preview :deep(code) { background: var(--bg-overlay); padding: 1px 5px; border-radius: 3px; font-size: .88em; color: var(--green); font-family: monospace; }
.editor-preview :deep(ul) { padding-left: 20px; margin: .5em 0; }
.editor-preview :deep(li) { margin: .25em 0; }
.editor-preview :deep(strong) { color: var(--accent); }
.editor-preview :deep(em) { color: var(--yellow); }
</style>
