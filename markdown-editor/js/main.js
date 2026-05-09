/**
 * 本地 Markdown WYSIWYG 编辑器 - 纯API模式（无需授权）
 * 核心原则：永不格式化源码，只做最小修改，不全局重排
 */
class MarkdownEditor {
  constructor() {
    // API 基础路径（本地服务地址）
    this.API_BASE = 'http://localhost:3000/api';
    
    // 文件相关
    this.currentFileName = null;
    this.currentFileContent = '';
    
    // 编辑模式
    this.editorMode = 'wysiwyg'; // 'wysiwyg' | 'source'
    
    // 自动保存相关
    this.saveTimeout = null;
    this.saveDelay = 1000; // 1秒防抖
    
    // DOM 元素
    this.editor = document.getElementById('editor');
    this.sourceEditor = document.getElementById('sourceEditor');
    this.modeToggleBtn = document.getElementById('modeToggleBtn');
    this.fileList = document.getElementById('fileList');
    this.currentFileNameEl = document.getElementById('currentFileName');
    this.saveStatusEl = document.getElementById('saveStatus');
    this.folderStatusEl = document.getElementById('folderStatus');
    this.selectFolderBtn = document.getElementById('selectFolderBtn');
    this.newNoteBtn = document.getElementById('newNoteBtn');
    this.newNoteModal = document.getElementById('newNoteModal');
    this.newNoteNameInput = document.getElementById('newNoteName');
    this.cancelNewNoteBtn = document.getElementById('cancelNewNote');
    this.confirmNewNoteBtn = document.getElementById('confirmNewNote');
    
    this.init();
  }

  init() {
    this.bindEvents();
    // 页面加载自动加载文件列表，无需授权
    this.autoLoadNotes();
  }

  /**
   * 自动加载笔记目录，无需授权
   */
  async autoLoadNotes() {
    try {
      this.folderStatusEl.textContent = '正在加载笔记...';
      // 加载文件列表并自动打开第一个文件
      await this.loadFileList();
      await this.autoOpenFirstFile();
      this.folderStatusEl.textContent = '✓ 已连接本地笔记目录';
      this.folderStatusEl.classList.add('authorized');
      // 隐藏授权按钮（不需要了）
      this.selectFolderBtn.style.display = 'none';
    } catch (error) {
      console.error('加载笔记失败:', error);
      this.folderStatusEl.textContent = '❌ 请先启动本地服务';
      this.folderStatusEl.style.color = '#ff4d4f';
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 模式切换
    this.modeToggleBtn.addEventListener('click', () => this.toggleEditorMode());
    
    // 新建笔记
    this.newNoteBtn.addEventListener('click', () => this.showNewNoteModal());
    this.cancelNewNoteBtn.addEventListener('click', () => this.hideNewNoteModal());
    this.confirmNewNoteBtn.addEventListener('click', () => this.createNewNote());
    this.newNoteNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.createNewNote();
      if (e.key === 'Escape') this.hideNewNoteModal();
    });
    
    // 编辑器内容变化
    this.editor.addEventListener('input', () => this.onContentChange('wysiwyg'));
    this.sourceEditor.addEventListener('input', () => this.onContentChange('source'));
    
    // 工具栏按钮
    document.querySelectorAll('.toolbar-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.executeToolbarAction(action);
      });
    });
    
    // 键盘快捷键
    this.editor.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    this.sourceEditor.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    
    // 点击模态框外部关闭
    this.newNoteModal.addEventListener('click', (e) => {
      if (e.target === this.newNoteModal) {
        this.hideNewNoteModal();
      }
    });
  }

  /**
   * 自动打开第一个文件
   */
  async autoOpenFirstFile() {
    const files = await this.getNoteList();
    if (files.length > 0) {
      await this.openFile(files[0]);
    }
  }

  /**
   * 切换编辑模式
   */
  toggleEditorMode() {
    // 切换前先同步内容
    this.syncContentBetweenModes(this.editorMode);

    if (this.editorMode === 'wysiwyg') {
      // 切换到源码模式
      this.editorMode = 'source';
      this.editor.classList.add('hidden');
      this.sourceEditor.classList.remove('hidden');
      this.modeToggleBtn.textContent = '预览';
      this.modeToggleBtn.classList.add('active');
      this.sourceEditor.focus();
    } else {
      // 切换到所见即所得模式
      this.editorMode = 'wysiwyg';
      this.sourceEditor.classList.add('hidden');
      this.editor.classList.remove('hidden');
      this.modeToggleBtn.textContent = '源码';
      this.modeToggleBtn.classList.remove('active');
      this.editor.focus();
    }
  }

  /**
   * 在两个模式间同步内容
   */
  syncContentBetweenModes(fromMode) {
    if (fromMode === 'wysiwyg') {
      // 从 WYSIWYG 同步到源码
      const content = this.htmlToMarkdown();
      this.sourceEditor.value = content;
    } else {
      // 从源码同步到 WYSIWYG
      const content = this.sourceEditor.value;
      this.renderMarkdownToHTML(content);
    }
  }

  /**
   * 获取笔记列表（API调用）
   */
  async getNoteList() {
    const response = await fetch(`${this.API_BASE}/notes`);
    if (!response.ok) throw new Error('获取笔记列表失败');
    return await response.json();
  }

  /**
   * 加载文件列表
   */
  async loadFileList() {
    const files = await this.getNoteList();
    // 按文件名排序
    files.sort((a, b) => a.localeCompare(b));
    this.renderFileList(files);
  }

  /**
   * 渲染文件列表
   */
  renderFileList(files) {
    if (files.length === 0) {
      this.fileList.innerHTML = `
        <div class="empty-state">
          <p>notes 文件夹为空</p>
          <p style="margin-top: 8px; font-size: 12px;">点击上方"新建"按钮创建第一个笔记</p>
        </div>
      `;
      return;
    }

    this.fileList.innerHTML = files.map(filename => `
      <div class="file-item" data-filename="${filename}">
        <span class="file-item-icon">📄</span>
        <span class="file-item-name">${filename}</span>
      </div>
    `).join('');

    // 绑定点击事件
    this.fileList.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const filename = item.dataset.filename;
        this.openFile(filename);
      });
    });
  }

  /**
   * 打开文件（API调用）
   */
  async openFile(filename) {
    try {
      // 先保存当前文件（如果有修改）
      if (this.currentFileName && this.hasChanges()) {
        await this.saveFile();
      }

      // 从API读取文件内容
      const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(filename)}`);
      if (!response.ok) throw new Error('打开文件失败');
      this.currentFileContent = await response.text();
      this.currentFileName = filename;

      // 渲染到两个编辑器
      this.renderMarkdownToHTML(this.currentFileContent);
      this.sourceEditor.value = this.currentFileContent;

      // 更新UI
      this.currentFileNameEl.textContent = filename;
      this.updateFileListActive(filename);
      this.saveStatusEl.textContent = '';

    } catch (error) {
      console.error('打开文件失败:', error);
      alert('打开文件失败: ' + error.message);
    }
  }

  /**
   * 将 Markdown 文本渲染为 HTML
   * 核心原则：只做最基本的渲染，绝不修改源码结构
   */
  renderMarkdownToHTML(markdown) {
    // 使用 innerText 保持原始格式
    this.editor.innerText = markdown;

    // 移除占位符
    const placeholder = this.editor.querySelector('.editor-placeholder');
    if (placeholder) {
      placeholder.remove();
    }
  }

  /**
   * 将 HTML 转换回 Markdown 文本
   * 核心原则：只提取纯文本，保持原始换行和空格
   */
  htmlToMarkdown() {
    // 使用 innerText 获取纯文本，最大程度保留原始格式
    return this.editor.innerText;
  }

  /**
   * 获取当前内容（根据当前模式）
   */
  getCurrentContent() {
    if (this.editorMode === 'wysiwyg') {
      return this.htmlToMarkdown();
    } else {
      return this.sourceEditor.value;
    }
  }

  /**
   * 更新文件列表选中状态
   */
  updateFileListActive(filename) {
    this.fileList.querySelectorAll('.file-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.filename === filename) {
        item.classList.add('active');
      }
    });
  }

  /**
   * 内容变化时触发
   */
  onContentChange(fromMode) {
    if (!this.currentFileName) return;

    // 移除占位符
    const placeholder = this.editor.querySelector('.editor-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    // 显示正在编辑状态
    this.saveStatusEl.textContent = '编辑中...';
    this.saveStatusEl.className = 'save-status';

    // 防抖自动保存
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveFile();
    }, this.saveDelay);
  }

  /**
   * 检查是否有未保存的修改
   */
  hasChanges() {
    const currentContent = this.getCurrentContent();
    return currentContent !== this.currentFileContent;
  }

  /**
   * 保存文件（API调用）
   * 核心原则：只写入纯文本，不做任何格式化处理
   */
  async saveFile() {
    if (!this.currentFileName) return;

    try {
      this.saveStatusEl.textContent = '保存中...';
      this.saveStatusEl.className = 'save-status saving';

      // 获取纯文本内容
      const content = this.getCurrentContent();

      // 调用API保存文件
      const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(this.currentFileName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        body: content
      });

      if (!response.ok) throw new Error('保存失败');

      // 更新当前内容缓存
      this.currentFileContent = content;

      this.saveStatusEl.textContent = '已保存 ✓';
      this.saveStatusEl.className = 'save-status saved';

      // 2秒后清除保存状态
      setTimeout(() => {
        if (this.saveStatusEl.textContent === '已保存 ✓') {
          this.saveStatusEl.textContent = '';
        }
      }, 2000);

    } catch (error) {
      console.error('保存文件失败:', error);
      this.saveStatusEl.textContent = '保存失败';
      this.saveStatusEl.style.color = '#ff4d4f';
    }
  }

  /**
   * 显示新建笔记对话框
   */
  showNewNoteModal() {
    this.newNoteModal.classList.add('show');
    this.newNoteNameInput.value = '';
    this.newNoteNameInput.focus();
  }

  /**
   * 隐藏新建笔记对话框
   */
  hideNewNoteModal() {
    this.newNoteModal.classList.remove('show');
  }

  /**
   * 创建新笔记（API调用）
   */
  async createNewNote() {
    let filename = this.newNoteNameInput.value.trim();

    if (!filename) {
      alert('请输入笔记文件名');
      return;
    }

    // 自动添加 .md 后缀
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    try {
      // 调用API创建新文件（写入空内容）
      const response = await fetch(`${this.API_BASE}/notes/${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        body: ''
      });

      if (!response.ok) {
        if (response.status === 409) {
          alert('文件已存在，请使用其他文件名');
          return;
        }
        throw new Error('创建文件失败');
      }

      this.hideNewNoteModal();

      // 刷新文件列表并打开新文件
      await this.loadFileList();
      await this.openFile(filename);

    } catch (error) {
      console.error('创建文件失败:', error);
      alert('创建文件失败: ' + error.message);
    }
  }

  /**
   * 执行工具栏操作
   */
  executeToolbarAction(action) {
    // 如果在源码模式，先切换焦点到源码编辑器
    const activeEditor = this.editorMode === 'wysiwyg' ? this.editor : this.sourceEditor;
    activeEditor.focus();

    const selection = window.getSelection();
    if (!selection.rangeCount && this.editorMode !== 'source') return;

    let prefix = '';
    let suffix = '';

    switch (action) {
      case 'bold':
        prefix = '**';
        suffix = '**';
        break;
      case 'italic':
        prefix = '*';
        suffix = '*';
        break;
      case 'heading':
        prefix = '# ';
        break;
      case 'link':
        prefix = '[';
        suffix = '](url)';
        break;
      case 'list':
        prefix = '- ';
        break;
      case 'code':
        prefix = '`';
        suffix = '`';
        break;
      case 'quote':
        prefix = '> ';
        break;
    }

    if (prefix || suffix) {
      if (this.editorMode === 'wysiwyg') {
        const selectedText = selection.toString();
        document.execCommand('insertText', false, prefix + selectedText + suffix);
      } else {
        // 源码模式下的插入处理
        const start = this.sourceEditor.selectionStart;
        const end = this.sourceEditor.selectionEnd;
        const selectedText = this.sourceEditor.value.substring(start, end);
        const newValue = this.sourceEditor.value.substring(0, start) + 
          prefix + selectedText + suffix + 
          this.sourceEditor.value.substring(end);
        this.sourceEditor.value = newValue;
        this.sourceEditor.selectionStart = this.sourceEditor.selectionEnd = start + prefix.length + selectedText.length;
      }
    }
  }

  /**
   * 处理键盘快捷键
   */
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + B 粗体
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      this.executeToolbarAction('bold');
    }
    // Ctrl/Cmd + I 斜体
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      this.executeToolbarAction('italic');
    }
    // Ctrl/Cmd + S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (this.currentFileName) {
        this.saveFile();
      }
    }
    // Ctrl/Cmd + Shift + M 切换模式
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      this.toggleEditorMode();
    }
    // Escape 关闭模态框
    if (e.key === 'Escape' && this.newNoteModal.classList.contains('show')) {
      this.hideNewNoteModal();
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new MarkdownEditor();
});

/**
 * 核心设计原则说明：
 * 
 * 1. 永不格式化源码：
 * - 使用 innerText 而非 innerHTML 读写内容
 * - 最大程度保留用户的换行、空格、缩进
 * - 不做任何全局 Markdown 解析和重渲染
 * 
 * 2. 纯API模式无需授权：
 * - 所有文件读写通过本地 HTTP API 完成
 * - 打开页面自动加载 notes 目录所有文件
 * - 无需用户点击授权，完全本地私有部署
 * 
 * 3. 最小修改原则：
 * - 自动保存只写入用户实际编辑的纯文本
 * - 不做任何语法解析、不重排结构
 * - 完全保留原始 Markdown 格式
 */