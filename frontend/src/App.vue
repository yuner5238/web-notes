<template>
  <div class="app">
    <!-- Microsoft Config Modal -->
    <div v-if="showMsConfigModal" class="modal-overlay" @click.self="showMsConfigModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <span class="modal-icon">&#128274;</span>
          <h2>配置 Microsoft 登录</h2>
        </div>
        <div class="modal-body">
          <p class="modal-desc">要使用待办事项功能，需要配置 Microsoft Graph API。</p>
          <div class="config-steps">
            <div class="step">
              <span class="step-num">1</span>
              <div class="step-text">
                <strong>注册 Azure 应用</strong><br>
                访问 <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank">Azure 门户</a>，点击"新建注册"
              </div>
            </div>
            <div class="step">
              <span class="step-num">2</span>
              <div class="step-text">
                <strong>设置重定向 URI</strong><br>
                在"身份验证"中添加：<code>http://localhost:3001/api/auth/callback</code>
              </div>
            </div>
            <div class="step">
              <span class="step-num">3</span>
              <div class="step-text">
                <strong>添加 API 权限</strong><br>
                添加 Microsoft Graph → <code>Tasks.ReadWrite</code>、<code>User.Read</code>、<code>offline_access</code>
              </div>
            </div>
            <div class="step">
              <span class="step-num">4</span>
              <div class="step-text">
                <strong>创建客户端密钥</strong><br>
                在"证书和密码"中新建密钥，复制其值
              </div>
            </div>
            <div class="step">
              <span class="step-num">5</span>
              <div class="step-text">
                <strong>填写配置文件</strong><br>
                编辑 <code>server/.env</code>：
                <div class="code-block">
MS_CLIENT_ID=你的应用程序(客户端)ID<br>
MS_CLIENT_SECRET=你创建的密钥值<br>
MS_TENANT_ID=common<br>
MS_REDIRECT_URI=http://localhost:3001/api/auth/callback
                </div>
              </div>
            </div>
            <div class="step">
              <span class="step-num">6</span>
              <div class="step-text">
                <strong>重启服务</strong><br>
                重启后端 <code>npm run dev</code> 后重新点击登录
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" @click="showMsConfigModal = false">知道了</button>
        </div>
      </div>
    </div>

    <header class="app-header">
      <div class="header-brand">
        <span class="brand-icon">&#128221;</span>
        <span class="brand-name">WebNotes</span>
      </div>
      <nav class="header-nav">
        <button
          class="nav-btn"
          :class="{ active: leftPanel === 'notes' }"
          @click="leftPanel = 'notes'"
        >
          <span>&#128214;</span> 笔记
        </button>
        <button
          class="nav-btn"
          :class="{ active: leftPanel === 'todos' }"
          @click="leftPanel = 'todos'"
        >
          <span>&#9745;</span> 待办
        </button>
      </nav>
      <div class="header-actions">
        <template v-if="!isLoggedIn">
          <button class="btn-login" @click="handleLogin">
            &#128274; 登录微软账号
          </button>
        </template>
        <template v-else>
          <span class="user-name">{{ userName }}</span>
          <button class="btn-icon" @click="handleLogout" title="登出">&#128682;</button>
        </template>
      </div>
    </header>

    <main class="app-body">
      <div class="panel-left" :class="leftPanel === 'notes' ? 'panel-notes' : 'panel-todos'">
        <NotesPanel
          :selectedKey="selectedNoteKey"
          @select="onSelectNote"
        />
      </div>
      <div class="panel-divider" />
      <div class="panel-right">
        <TodoPanel :isLoggedIn="isLoggedIn" />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import NotesPanel from './components/NotesPanel.vue'
import TodoPanel from './components/TodoPanel.vue'
import { getAuthStatus, login, logout, getCurrentUser } from './api/auth.js'

const leftPanel = ref('notes')
const isLoggedIn = ref(false)
const userName = ref('')
const selectedNoteKey = ref(null)
const showMsConfigModal = ref(false)

onMounted(async () => {
  // Check URL params
  const params = new URLSearchParams(window.location.search)
  if (params.get('ms_error')) {
    showMsConfigModal.value = true
    window.history.replaceState({}, '', window.location.pathname)
  }
  if (params.get('auth') === 'ok') {
    window.history.replaceState({}, '', window.location.pathname)
  }

  // Check auth status
  try {
    const status = await getAuthStatus()
    isLoggedIn.value = status.authenticated
    if (status.authenticated) {
      const user = await getCurrentUser()
      if (user) userName.value = user.displayName || user.mail || '用户'
    }
  } catch (e) {
    console.error(e)
  }
})

function handleLogin() {
  login()
}

async function handleLogout() {
  await logout()
}

function onSelectNote(key) {
  selectedNoteKey.value = key
}
</script>

<style scoped>
.app { display: flex; flex-direction: column; height: 100vh; background: var(--bg-base); }

.app-header {
  display: flex; align-items: center; height: 52px; padding: 0 16px;
  background: var(--bg-mantle); border-bottom: 1px solid var(--border);
  flex-shrink: 0; gap: 16px;
}

.header-brand { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; min-width: 140px; }
.header-brand .brand-icon { font-size: 18px; }

.header-nav { display: flex; gap: 4px; flex: 1; }

.nav-btn {
  display: flex; align-items: center; gap: 6px; padding: 6px 14px;
  border-radius: var(--radius-sm); background: transparent;
  color: var(--muted); font-size: 13px; font-weight: 500;
}
.nav-btn:hover { background: var(--bg-overlay); color: var(--text); }
.nav-btn.active { background: var(--bg-overlay); color: var(--accent); }

.header-actions { display: flex; align-items: center; gap: 8px; min-width: 180px; justify-content: flex-end; }

.btn-login {
  display: flex; align-items: center; gap: 6px; padding: 6px 14px;
  border-radius: var(--radius-sm); background: var(--accent); color: #11111b;
  font-size: 13px; font-weight: 600;
}
.btn-login:hover { background: var(--accent-hover); }

.btn-icon {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: var(--radius-sm);
  background: transparent; color: var(--muted); font-size: 16px;
}
.btn-icon:hover { background: var(--bg-overlay); color: var(--text); }

.user-name { font-size: 13px; color: var(--subtext); }

.app-body { display: flex; flex: 1; overflow: hidden; }
.panel-left { display: flex; flex-direction: column; overflow: hidden; }
.panel-left.panel-notes { flex: 3; }
.panel-left.panel-todos { flex: 1.2; }
.panel-right { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.panel-divider { width: 1px; background: var(--border); flex-shrink: 0; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; backdrop-filter: blur(4px);
}
.modal-box {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: 12px; width: 560px; max-height: 85vh;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,.5);
}
.modal-header {
  display: flex; align-items: center; gap: 12px;
  padding: 20px 24px 16px; border-bottom: 1px solid var(--border);
}
.modal-icon { font-size: 28px; }
.modal-header h2 { font-size: 16px; font-weight: 600; color: var(--text); }
.modal-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
.modal-desc { font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.6; }
.config-steps { display: flex; flex-direction: column; gap: 14px; }
.step { display: flex; gap: 12px; align-items: flex-start; }
.step-num {
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--accent); color: #11111b;
  font-size: 12px; font-weight: 700; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;
}
.step-text { font-size: 13px; color: var(--subtext); line-height: 1.6; }
.step-text strong { color: var(--text); }
.step-text a { color: var(--accent); }
.step-text code {
  background: var(--bg-overlay); padding: 1px 5px; border-radius: 3px;
  font-size: 11px; color: var(--green); font-family: monospace;
}
.code-block {
  margin-top: 8px; background: var(--bg-mantle);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 10px 12px; font-family: monospace; font-size: 11px;
  color: var(--green); line-height: 1.8; white-space: pre-wrap;
}
.modal-footer {
  padding: 14px 24px; border-top: 1px solid var(--border);
  display: flex; justify-content: flex-end;
}
.btn-primary {
  padding: 8px 20px; background: var(--accent); color: #11111b;
  border-radius: var(--radius); font-size: 13px; font-weight: 600;
}
.btn-primary:hover { background: var(--accent-hover); }
</style>
