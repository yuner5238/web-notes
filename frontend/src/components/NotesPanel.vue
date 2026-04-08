<template>
  <div class="notes-panel">
    <!-- 侧边栏 -->
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

    <!-- 编辑器 -->
    <div class="notes-editor">
      <div v-if="!selected" class="editor-empty">
        <div class="empty-icon">📝</div>
        <p>选择一个笔记开始编辑</p>
      </div>
      <template v-else>

        <!-- 工具栏 -->
        <div class="editor-toolbar">
          <button class="tbtn" @click="fmt('bold')" title="加粗 (Ctrl+B)"><b>B</b></button>
          <button class="tbtn" @click="fmt('italic')" title="斜体 (Ctrl+I)"><em>I</em></button>
          <button class="tbtn" @click="fmt('strike')" title="删除线"><s>S</s></button>
          <div class="tsep" />
          <button class="tbtn fmt-btn" @click="fmt('h1')" title="一级标题">H1</button>
          <button class="tbtn fmt-btn" @click="fmt('h2')" title="二级标题">H2</button>
          <button class="tbtn fmt-btn" @click="fmt('h3')" title="三级标题">H3</button>
          <div class="tsep" />
          <button class="tbtn" @click="fmt('quote')" title="引用">❝</button>
          <button class="tbtn" @click="fmt('ul')" title="无序列表">•</button>
          <button class="tbtn" @click="fmt('ol')" title="有序列表">1.</button>
          <button class="tbtn" @click="fmt('code')" title="行内代码">&lt;/&gt;</button>
          <button class="tbtn" @click="fmt('codeblock')" title="代码块">&lt;/&gt;</button>
          <div class="tsep" />
          <button class="tbtn" @click="fmt('link')" title="链接">🔗</button>
          <button class="tbtn" @click="fmt('hr')" title="分割线">—</button>
          <button class="tbtn" @click="fmt('todo')" title="待办">☐</button>
          <div class="tsep" />
          <div class="mode-group">
            <button class="tbtn mode-btn" :class="{ active: mode === 'source' }" @click="setMode('source')" title="源码">✍</button>
            <button class="tbtn mode-btn" :class="{ active: mode === 'split' }" @click="setMode('split')" title="分栏">⫷⫸</button>
            <button class="tbtn mode-btn" :class="{ active: mode === 'preview' }" @click="setMode('preview')" title="阅读">👁</button>
          </div>
          <div class="tsep" />
          <span v-if="mode !== 'source'" class="word-count">{{ wordCount }} 字</span>
          <div style="flex:1" />
          <button
            class="tbtn btn-save"
            :class="{ saving: saving, unsaved: hasUnsavedChanges }"
            @click="doSave"
            :disabled="!selected || saving"
            title="保存 (Ctrl+S)"
          >{{ saving ? '···' : hasUnsavedChanges ? '●' : '✓' }}</button>
          <span class="save-status">{{ saveStatus }}</span>
        </div>

        <!-- 标题 -->
        <div class="editor-title">
          <input v-model="selected.name" type="text" readonly />
        </div>

        <!-- 编辑区分栏布局 -->
        <div class="editor-split">
          <!-- 源码编辑区（textarea） -->
          <div v-show="mode !== 'preview'" class="editor-pane editor-pane-write">
            <textarea
              ref="ta"
              v-model="content"
              placeholder="开始写作..."
              spellcheck="false"
              @keydown="handleKeyDown"
            />
          </div>

          <div v-show="mode === 'split'" class="editor-divider" />

          <!-- 阅读/富文本编辑区 -->
          <div v-show="mode !== 'source'" class="editor-pane editor-pane-preview">
            <!-- contenteditable 富文本编辑层 -->
            <div
              ref="richEl"
              class="rich-editor"
              contenteditable="true"
              spellcheck="false"
              :data-placeholder="'开始写作...'"
              @input="onRichInput"
              @keydown="handleRichKeyDown"
              @mouseup="syncSelection"
              @keyup="syncSelection"
            />
            <!-- 纯预览层（md 渲染） -->
            <div v-show="mode === 'preview'" class="rich-preview" v-html="renderedMd" />
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { marked } from 'marked'
import { listNotes, getNote, saveNote, deleteNote } from '../api/index.js'

marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({ selectedKey: String })
const emit = defineEmits(['select'])

const notes = ref([])
const selected = ref(null)
const content = ref('')
const savedContent = ref('')
const search = ref('')
const loading = ref(true)
const creating = ref(false)
const saving = ref(false)
const saveStatus = ref('')
const ta = ref(null)
const richEl = ref(null)
const mode = ref('split') // 'source' | 'split' | 'preview'
let richSyncing = false // 防止 contenteditable 和 content 之间循环更新

const hasUnsavedChanges = computed(() =>
  selected.value && content.value !== savedContent.value
)

const filteredNotes = computed(() =>
  notes.value.filter(n => n.name.toLowerCase().includes(search.value.toLowerCase()))
)

const wordCount = computed(() => content.value.trim() ? content.value.trim().replace(/\s+/g, '').length : 0)

const renderedMd = computed(() => {
  try { return marked.parse(content.value || '') }
  catch { return '<p style="color:red">渲染错误</p>' }
})

// ── 模式切换 ──────────────────────────────────────────────────────────

function setMode(m) {
  mode.value = m
  nextTick(() => {
    if (m === 'source') ta.value?.focus()
    else if (m === 'preview') {
      richEl.value?.focus()
      moveCursorToEnd(richEl.value)
    } else {
      ta.value?.focus()
    }
  })
}

// ── 内容同步 ──────────────────────────────────────────────────────────

// 当 content（Markdown 原文）变化时，同步到 contenteditable
watch(content, (val) => {
  if (richSyncing) return
  if (mode.value === 'source') return // 源码模式不碰 contenteditable
  richSyncing = true
  nextTick(() => {
    syncRichFromMd(val)
    richSyncing = false
  })
})

// 从 Markdown 原文同步到 contenteditable（隐藏 Markdown 语法，只显示内容）
function syncRichFromMd(md) {
  if (!richEl.value) return
  richEl.value.innerHTML = ''

  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const el = document.createElement('div')
    el.innerHTML = tokenizeLine(line)
    richEl.value.appendChild(el)
    if (i < lines.length - 1) {
      // 保留换行
      const br = document.createElement('br')
      richEl.value.appendChild(br)
    }
  }
}

// 把一行 Markdown 转换为带样式的 HTML（语法字符用相同颜色隐藏）
function tokenizeLine(line) {
  // 按序处理，先处理代码块（整行）
  if (/^```/.test(line)) {
    return `<span class="md-code-block">${escapeHtml(line)}</span>`
  }
  if (line.trim() === '---') {
    return `<span class="md-hr">${escapeHtml(line)}</span>`
  }
  // 行内处理
  let result = escapeHtml(line)
  // 处理标题
  result = result.replace(/^# (.+)$/, '<span class="md-h1"># $1</span>')
  result = result.replace(/^## (.+)$/, '<span class="md-h2">## $1</span>')
  result = result.replace(/^### (.+)$/, '<span class="md-h3">### $1</span>')
  // 处理列表
  result = result.replace(/^(\s*)[-*] /, '$1<span class="md-list-mark">- </span>')
  result = result.replace(/^(\s*)\d+\. /, '$1<span class="md-list-mark">1. </span>')
  // 处理待办
  result = result.replace(/^(\s*)[-*] \[x\] /i, '$1<span class="md-list-mark">- [x] </span>')
  result = result.replace(/^(\s*)[-*] \[ \] /, '$1<span class="md-list-mark">- [ ] </span>')
  // 处理引用
  result = result.replace(/^&gt; /, '<span class="md-quote-mark">&gt; </span>')
  // 行内代码
  result = result.replace(/`([^`]+)`/, '<span class="md-code">`$1`</span>')
  // 加粗
  result = result.replace(/\*\*(.+?)\*\*/g, '<span class="md-bold">**$1**</span>')
  // 斜体
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<span class="md-italic">*$1*</span>')
  result = result.replace(/__(.+?)__/g, '<span class="md-italic">__$1__</span>')
  // 删除线
  result = result.replace(/~~(.+?)~~/g, '<span class="md-strike">~~$1~~</span>')
  // 链接
  result = result.replace(/\[(.+?)\]\((.+?)\)/g, '<span class="md-link">[$1]($2)</span>')
  return `<span class="md-line">${result}</span>`
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// contenteditable 内容变化 → 更新 Markdown 原文
function onRichInput() {
  if (richSyncing) return
  richSyncing = true
  content.value = extractMdFromRich()
  richSyncing = false
}

// 从 contenteditable 提取回 Markdown
function extractMdFromRich() {
  if (!richEl.value) return ''
  const lines = []
  const children = richEl.value.childNodes
  for (const node of children) {
    if (node.nodeName === 'BR') {
      lines.push('')
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      lines.push(extractLineMd(node))
    } else if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent
      if (t) lines.push(t)
    }
  }
  return lines.join('\n')
}

function extractLineMd(el) {
  // 递归提取一行元素的 Markdown
  if (el.classList.contains('md-h1')) return '# ' + extractText(el)
  if (el.classList.contains('md-h2')) return '## ' + extractText(el)
  if (el.classList.contains('md-h3')) return '### ' + extractText(el)
  if (el.classList.contains('md-quote-mark')) return '> ' + extractText(el)
  if (el.classList.contains('md-list-mark')) return extractListMark(el)
  if (el.classList.contains('md-hr')) return '---'
  if (el.classList.contains('md-code-block')) return extractText(el)
  // 普通行
  return extractInlineMd(el)
}

function extractText(el) {
  let text = ''
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) text += child.textContent
    else if (child.nodeType === Node.ELEMENT_NODE) text += extractInlineMd(child)
  }
  return text
}

function extractInlineMd(el) {
  if (el.classList.contains('md-bold')) return '**' + extractText(el) + '**'
  if (el.classList.contains('md-italic')) return '*' + extractText(el) + '*'
  if (el.classList.contains('md-strike')) return '~~' + extractText(el) + '~~'
  if (el.classList.contains('md-code')) return '`' + extractText(el) + '`'
  if (el.classList.contains('md-link')) return extractText(el)
  return extractText(el)
}

function extractListMark(el) {
  const full = el.textContent || ''
  if (full.includes('- [x]') || full.includes('- [X]')) return '- [x] '
  if (full.includes('- [ ]')) return '- [ ] '
  if (/^\d+\./.test(full)) return full.replace(/\d+/, '1') + ' '
  return full + ' '
}

// contenteditable 末尾放光标
function moveCursorToEnd(el) {
  if (!el) return
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

// ── 富文本格式操作（操作 Markdown 原文） ───────────────────────────────

function fmt(type) {
  richSyncing = true

  // 如果是源码模式，操作 textarea
  if (mode.value === 'source') {
    ta.value?.focus()
    fmtTextarea(type)
    richSyncing = false
    return
  }

  // 阅读/分栏模式：操作 contenteditable
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    // 无选区，插入块级元素
    insertBlock(type)
    richSyncing = false
    return
  }

  const range = sel.getRangeAt(0)
  const selectedText = sel.toString()
  let mdBefore = '', mdWrap = '', mdAfter = '', mdLinePrefix = ''

  switch (type) {
    case 'bold':        mdWrap = '**'; break
    case 'italic':      mdWrap = '*'; break
    case 'strike':      mdWrap = '~~'; break
    case 'code':        mdWrap = '`'; break
    case 'h1':          mdLinePrefix = '# '; insertBlockAtLine('## ', '# '); richSyncing = false; return
    case 'h2':          mdLinePrefix = '## '; insertBlockAtLine('### ', '## '); richSyncing = false; return
    case 'h3':          mdLinePrefix = '### '; insertBlockAtLine('#### ', '### '); richSyncing = false; return
    case 'quote':       insertLinePrefix('> '); richSyncing = false; return
    case 'ul':          insertLinePrefix('- '); richSyncing = false; return
    case 'ol':          insertLinePrefix('1. '); richSyncing = false; return
    case 'codeblock':   mdBefore = '```\n'; mdWrap = ''; mdAfter = '\n```'; selectedText || insertBlock('codeblock'); break
    case 'link':        mdBefore = '['; mdWrap = ''; mdAfter = '](url)'; selectedText || insertText('链接文本'); break
    case 'hr':          insertHr(); richSyncing = false; return
    case 'todo':        insertLinePrefix('- [ ] '); richSyncing = false; return
    default:            richSyncing = false; return
  }

  // 操作 contenteditable：找到选中节点，插入 span 包装
  applyWrapToSelection(mdWrap, selectedText)

  // 同时更新 content
  content.value = extractMdFromRich()

  nextTick(() => {
    richSyncing = false
    richEl.value?.focus()
    syncRichFromMd(content.value)
  })
}

function fmtTextarea(type) {
  const el = ta.value
  if (!el) return
  const s = el.selectionStart, e = el.selectionEnd, sel = content.value.slice(s, e)

  const cases = {
    bold:       ['**', '**'],
    italic:     ['*', '*'],
    strike:     ['~~', '~~'],
    code:       ['`', '`'],
    h1:         ['# ', ''],
    h2:         ['## ', ''],
    h3:         ['### ', ''],
    quote:      ['> ', ''],
    ul:         ['- ', ''],
    ol:         ['1. ', ''],
    codeblock:  ['```\n', '\n```'],
    link:       ['[', '](url)'],
    hr:         ['', '\n\n---\n\n'],
    todo:       ['- [ ] ', ''],
  }

  const [b, a] = cases[type] || ['', '']
  if (type === 'hr') {
    const line = content.value.slice(0, s).split('\n').slice(-1)[0] || ''
    const alreadyHr = /^---+$/.test(line.trim())
    if (alreadyHr) {
      content.value = content.value.slice(0, s - line.length) + content.value.slice(e)
      nextTick(() => el.setSelectionRange(s - line.length, s - line.length))
    } else {
      const atLineStart = s === 0 || content.value[s - 1] === '\n'
      if (atLineStart && s > 0) {
        content.value = content.value.slice(0, s) + '---' + content.value.slice(e)
        nextTick(() => el.setSelectionRange(s + 3, s + 3))
      } else {
        content.value = content.value.slice(0, s) + '\n---\n' + content.value.slice(e)
        nextTick(() => el.setSelectionRange(s + 5, s + 5))
      }
    }
    return
  }

  content.value = content.value.slice(0, s) + b + sel + a + content.value.slice(e)
  nextTick(() => {
    el.focus()
    el.setSelectionRange(s + b.length, s + b.length + sel.length)
  })
}

// 在 contenteditable 中给选中文本包裹 Markdown 语法（视觉上隐藏）
function applyWrapToSelection(marker, text) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const selectedText = text || sel.toString()
  if (!selectedText) return

  // 创建一个 wrapper span，视觉上显示加粗/斜体效果
  const wrapper = document.createElement('span')
  wrapper.className = `fmt-${marker === '**' ? 'bold' : marker === '*' ? 'italic' : marker === '~~' ? 'strike' : marker === '`' ? 'code' : ''}`

  const before = document.createTextNode(marker)
  const content = document.createTextNode(selectedText)
  const after = document.createTextNode(marker)
  wrapper.appendChild(before)
  wrapper.appendChild(content)
  wrapper.appendChild(after)

  range.deleteContents()
  range.insertNode(wrapper)

  // 恢复选区在内容上
  const newSel = window.getSelection()
  newSel.removeAllRanges()
  const newRange = document.createRange()
  newRange.setStartAfter(before)
  newRange.setEndBefore(after)
  newSel.addRange(newRange)
}

// 无选区时插入块级元素（Markdown 行前缀）
function insertLinePrefix(prefix) {
  if (!richEl.value) return
  richEl.value.focus()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  // 找到当前行开头
  const range = sel.getRangeAt(0)
  let node = range.startContainer
  // 往上找到 div 行元素
  while (node && !node.classList?.contains('md-line') && node !== richEl.value) {
    node = node.parentNode
  }
  if (!node) return

  // 在行首插入前缀 span
  const prefixSpan = document.createElement('span')
  prefixSpan.className = 'md-list-mark md-quote-mark'
  prefixSpan.textContent = prefix
  if (node.firstChild) {
    node.insertBefore(prefixSpan, node.firstChild)
  } else {
    node.appendChild(prefixSpan)
  }

  // 同步到 content
  content.value = extractMdFromRich()
  nextTick(() => syncRichFromMd(content.value))
}

function insertBlockAtLine(newPrefix, removePrefix) {
  if (!richEl.value) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  // 找到当前行
  let node = sel.anchorNode
  while (node && !node.classList?.contains('md-line') && node !== richEl.value) {
    node = node.parentNode
  }
  if (!node) return

  // 替换行首前缀
  const firstSpan = node.querySelector('.md-h1, .md-h2, .md-h3, .md-list-mark, .md-quote-mark')
  if (firstSpan) {
    firstSpan.textContent = newPrefix
  } else {
    const prefixSpan = document.createElement('span')
    prefixSpan.className = 'md-h1'
    prefixSpan.textContent = newPrefix
    if (node.firstChild) node.insertBefore(prefixSpan, node.firstChild)
    else node.appendChild(prefixSpan)
  }

  content.value = extractMdFromRich()
  nextTick(() => syncRichFromMd(content.value))
}

function insertBlock(type) {
  if (type === 'hr') { insertHr(); return }
  if (type === 'codeblock') {
    insertCodeBlock()
  } else {
    insertLinePrefix('')
  }
}

function insertHr() {
  if (!richEl.value) return
  richEl.value.focus()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const hr = document.createElement('span')
  hr.className = 'md-hr'
  hr.textContent = '---'

  const range = sel.getRangeAt(0)
  range.deleteContents()
  range.insertNode(hr)

  const br = document.createElement('br')
  hr.after(br)

  content.value = extractMdFromRich()
  nextTick(() => {
    syncRichFromMd(content.value)
    richEl.value?.focus()
  })
}

function insertCodeBlock() {
  if (!richEl.value) return
  richEl.value.focus()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const range = sel.getRangeAt(0)
  const cbBefore = document.createElement('span')
  cbBefore.className = 'md-code-block'
  cbBefore.textContent = '```'
  const cbAfter = document.createElement('span')
  cbAfter.className = 'md-code-block'
  cbAfter.textContent = '```'

  range.deleteContents()
  range.insertNode(cbBefore)
  range.insertNode(cbAfter)
  cbBefore.after(document.createElement('br'))

  content.value = extractMdFromMd()
  nextTick(() => {
    syncRichFromMd(content.value)
    richEl.value?.focus()
  })
}

function insertText(text) {
  if (!richEl.value) return
  richEl.value.focus()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const range = sel.getRangeAt(0)
  const node = document.createTextNode(text)
  range.deleteContents()
  range.insertNode(node)

  const newSel = window.getSelection()
  newSel.removeAllRanges()
  const newRange = document.createRange()
  newRange.setStartAfter(node)
  newRange.collapse(true)
  newSel.addRange(newRange)

  content.value = extractMdFromRich()
  nextTick(() => syncRichFromMd(content.value))
}

function syncSelection() {
  // 用户选中文字时，不做任何转换，保持原样
}

// ── 键盘快捷键 ─────────────────────────────────────────────────────────

function handleKeyDown(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 's') { e.preventDefault(); if (selected.value && !saving.value) doSave() }
    else if (e.key === 'b') { e.preventDefault(); fmt('bold') }
    else if (e.key === 'i') { e.preventDefault(); fmt('italic') }
    else if (e.key === 'e') {
      e.preventDefault()
      const modes = ['source', 'split', 'preview']
      setMode(modes[(modes.indexOf(mode.value) + 1) % modes.length])
    }
  }
}

function handleRichKeyDown(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 's') { e.preventDefault(); if (selected.value && !saving.value) doSave() }
    else if (e.key === 'b') { e.preventDefault(); fmt('bold') }
    else if (e.key === 'i') { e.preventDefault(); fmt('italic') }
    else if (e.key === 'e') {
      e.preventDefault()
      const modes = ['source', 'split', 'preview']
      setMode(modes[(modes.indexOf(mode.value) + 1) % modes.length])
    }
  }
  // 回车在无序列表后自动继续
  if (e.key === 'Enter') {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      // 检查当前行是否以列表开头
      let node = sel.anchorNode
      while (node && node !== richEl.value) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const mark = node.querySelector('.md-list-mark')
          if (mark) {
            e.preventDefault()
            const br = document.createElement('br')
            const newDiv = document.createElement('div')
            const markClone = document.createElement('span')
            markClone.className = mark.className
            markClone.textContent = mark.textContent.replace(/\d+/, '1')
            const textSpan = document.createElement('span')
            newDiv.appendChild(markClone)
            newDiv.appendChild(textSpan)
            if (node.nextSibling) {
              richEl.value.insertBefore(newDiv, node.nextSibling)
            } else {
              richEl.value.appendChild(newDiv)
            }
            richEl.value.insertBefore(br, newDiv)
            nextTick(() => {
              const newSel = window.getSelection()
              newSel.removeAllRanges()
              const nr = document.createRange()
              nr.setStart(textSpan, 0)
              nr.collapse(true)
              newSel.addRange(nr)
            })
            return
          }
        }
        node = node.parentNode
      }
    }
  }
}

// ── 笔记操作 ──────────────────────────────────────────────────────────

onMounted(loadNotes)

async function loadNotes() {
  try { notes.value = await listNotes() }
  catch (e) { console.error('加载失败', e) }
  finally { loading.value = false }
}

async function selectNote(note) {
  selected.value = { ...note }
  content.value = await getNote(note.key)
  savedContent.value = content.value
  saveStatus.value = ''
  emit('select', note.key)
  nextTick(() => {
    if (mode.value !== 'source') {
      richSyncing = true
      syncRichFromMd(content.value)
      richSyncing = false
    }
  })
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

async function doSave() {
  if (!selected.value || saving.value) return
  saving.value = true
  try {
    saveStatus.value = '保存中...'
    // 确保 content 是最新的（从 contenteditable 提取）
    if (mode.value !== 'source') {
      content.value = extractMdFromRich()
    }
    await saveNote(selected.value.key, content.value)
    savedContent.value = content.value
    saveStatus.value = '已保存 ✓'
    setTimeout(() => { saveStatus.value = '' }, 2000)
  } catch (e) {
    saveStatus.value = '保存失败'
    console.error(e)
  } finally {
    saving.value = false
  }
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
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
.editor-toolbar { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; flex-wrap: wrap; row-gap: 4px; }
.tbtn { min-width: 28px; height: 28px; padding: 0 6px; border-radius: var(--radius-sm); background: transparent; color: var(--muted); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer; white-space: nowrap; }
.tbtn:hover { background: var(--bg-overlay); color: var(--text); }
.tbtn.active { color: var(--accent); }
.tsep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; flex-shrink: 0; }
.save-status { font-size: 11px; color: var(--green); }
.btn-save { transition: all .2s; min-width: 28px; }
.btn-save.unsaved { color: var(--yellow); }
.btn-save.unsaved:hover { background: var(--yellow); color: #11111b; }
.btn-save.saving { color: var(--muted); }
.btn-save:disabled:not(.unsaved):not(.saving) { opacity: .4; }
.mode-group { display: flex; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; }
.mode-btn { border-radius: 0; min-width: 28px; height: 28px; padding: 0; }
.mode-btn:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.mode-btn:last-child { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.word-count { font-size: 11px; color: var(--muted); padding: 0 6px; white-space: nowrap; }
.editor-title { padding: 10px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.editor-title input { width: 100%; background: transparent; border: none; font-size: 16px; font-weight: 600; color: var(--text); padding: 0; }
.editor-title input:focus { outline: none; }
.editor-split { flex: 1; display: flex; overflow: hidden; }
.editor-pane { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.editor-pane-write textarea {
  flex: 1; width: 100%; padding: 16px 20px;
  font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: 14px; line-height: 1.8; background: transparent;
  border: none; color: var(--text); resize: none;
}
.editor-pane-write textarea:focus { outline: none; }
.editor-divider { width: 1px; background: var(--border); flex-shrink: 0; }
.editor-pane-preview { overflow-y: auto; position: relative; }

/* ── 富文本编辑层 ──────────────────────────────────────────────────── */
.rich-editor {
  flex: 1; padding: 16px 24px; font-size: 14px; line-height: 1.8;
  color: var(--text); outline: none; min-height: 100%;
  word-break: break-word; overflow-wrap: break-word;
  caret-color: var(--accent);
}
.rich-editor:empty::before {
  content: attr(data-placeholder); color: var(--muted); pointer-events: none;
}

/* 纯预览层 */
.rich-preview {
  position: absolute; inset: 0; padding: 16px 24px;
  font-size: 14px; line-height: 1.8; overflow-y: auto; display: none;
}

/* ── Markdown 语法隐藏（富文本效果） ──────────────────────────────── */
.md-line { color: var(--text); }
.md-h1, .md-h2, .md-h3 {
  color: var(--accent-hover); font-weight: 700; display: block;
}
.md-h1 .md-h1, .md-h2 .md-h2, .md-h3 .md-h3 { color: var(--accent-hover); font-size: inherit; font-weight: 700; }
.md-list-mark { color: var(--accent); font-weight: 700; }
.md-quote-mark { color: var(--yellow); font-style: italic; }
.md-code-block { color: var(--muted); display: block; background: var(--bg-overlay); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: .9em; }
.md-hr { color: var(--muted); display: block; opacity: .4; }

/* 行内语法隐藏（不显示语法字符，只显示样式） */
.md-bold span.md-bold,
.md-italic span.md-italic,
.md-strike span.md-strike,
.md-code span.md-code {
  /* 语法字符颜色透明，达到隐藏效果 */
}
.md-bold .md-bold,
.md-italic .md-italic,
.md-strike .md-strike,
.md-code .md-code {
  /* 加粗：内容本身变粗，语法字符透明 */
}
.md-bold span:first-child,
.md-italic span:first-child,
.md-strike span:first-child,
.md-code span:first-child {
  /* 开头语法字符透明 */
}
.md-bold span:last-child,
.md-italic span:last-child,
.md-strike span:last-child,
.md-code span:last-child {
  /* 结尾语法字符透明 */
}
.md-bold { font-weight: 700; }
.md-italic { font-style: italic; }
.md-strike { text-decoration: line-through; color: var(--muted); }
.md-code { background: var(--bg-overlay); padding: 1px 6px; border-radius: 4px; font-size: .88em; color: var(--green); font-family: 'Fira Code', monospace; }
.md-link { color: var(--accent); text-decoration: underline; }
.md-code-block { color: var(--muted); background: var(--bg-overlay); display: block; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: .9em; }

/* ── 预览层样式（阅读模式） ───────────────────────────────────────── */
.rich-preview :deep(h1) { color: var(--accent-hover); font-size: 1.7em; margin: .8em 0 .3em; border-bottom: 1px solid var(--border); padding-bottom: .2em; }
.rich-preview :deep(h2) { color: var(--accent-hover); font-size: 1.35em; margin: .7em 0 .25em; border-bottom: 1px solid var(--border); padding-bottom: .15em; }
.rich-preview :deep(h3) { color: var(--accent-hover); font-size: 1.1em; margin: .6em 0 .25em; }
.rich-preview :deep(p) { margin: .6em 0; }
.rich-preview :deep(ul), .rich-preview :deep(ol) { padding-left: 24px; margin: .5em 0; }
.rich-preview :deep(li) { margin: .3em 0; }
.rich-preview :deep(code) { background: var(--bg-overlay); padding: 1px 6px; border-radius: 4px; font-size: .88em; color: var(--green); font-family: 'Fira Code', monospace; }
.rich-preview :deep(pre) { background: var(--bg-overlay); padding: 14px 16px; border-radius: 8px; overflow-x: auto; margin: .8em 0; }
.rich-preview :deep(pre code) { background: none; padding: 0; font-size: .9em; }
.rich-preview :deep(blockquote) { border-left: 3px solid var(--accent); padding-left: 14px; margin: .8em 0; color: var(--muted); }
.rich-preview :deep(strong) { color: var(--accent); }
.rich-preview :deep(a) { color: var(--accent); text-decoration: underline; }
.rich-preview :deep(hr) { border: none; border-top: 1px solid var(--border); margin: 1em 0; }
.rich-preview :deep(table) { border-collapse: collapse; width: 100%; margin: .8em 0; }
.rich-preview :deep(th), .rich-preview :deep(td) { border: 1px solid var(--border); padding: 6px 12px; }
.rich-preview :deep(th) { background: var(--bg-overlay); font-weight: 600; }

/* ── 行内格式 wrapper（选中文字后加粗等操作生成） ────────────────── */
.fmt-bold { font-weight: 700; }
.fmt-italic { font-style: italic; }
.fmt-strike { text-decoration: line-through; color: var(--muted); }
.fmt-code { background: var(--bg-overlay); padding: 1px 6px; border-radius: 4px; font-size: .88em; color: var(--green); font-family: 'Fira Code', monospace; }
</style>
