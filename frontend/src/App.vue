<template>
  <div class="app">
    <!-- Top Bar -->
    <header class="topbar">
      <div class="topbar-brand">
        <span class="brand-icon">📝</span>
        <span class="brand-name">WebNotes</span>
      </div>
      <div class="topbar-actions">
        <template v-if="!isLoggedIn">
          <button class="btn-login" @click="handleLogin">登录</button>
        </template>
        <template v-else>
          <span class="user-name">{{ userName }}</span>
          <button class="btn-logout" @click="handleLogout">退出</button>
        </template>
      </div>
    </header>

    <!-- Content Area -->
    <main class="content">
      <NotesPanel
        v-show="activeTab === 'notes'"
        :selectedKey="selectedNoteKey"
        @select="onSelectNote"
      />
      <TodoPanel
        v-show="activeTab === 'todos'"
        :isLoggedIn="isLoggedIn"
      />
    </main>

    <!-- Bottom Tab Bar -->
    <nav class="tabbar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'notes' }"
        @click="activeTab = 'notes'"
      >
        <span class="tab-icon">📖</span>
        <span class="tab-label">笔记</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'todos' }"
        @click="activeTab = 'todos'"
      >
        <span class="tab-icon">✅</span>
        <span class="tab-label">待办</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import NotesPanel from './components/NotesPanel.vue'
import TodoPanel from './components/TodoPanel.vue'
import { getAuthStatus, login, logout, getCurrentUser } from './api/auth.js'

const activeTab = ref('notes')
const isLoggedIn = ref(false)
const userName = ref('')
const selectedNoteKey = ref(null)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('auth') === 'ok') {
    window.history.replaceState({}, '', window.location.pathname)
  }

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
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--bg-base);
  max-width: 100vw;
  overflow: hidden;
}

/* ── Top Bar ── */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background: var(--bg-mantle);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.topbar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon { font-size: 20px; }

.brand-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-login {
  padding: 6px 16px;
  border-radius: 20px;
  background: var(--accent);
  color: #11111b;
  font-size: 13px;
  font-weight: 600;
}

.btn-login:hover { background: var(--accent-hover); }

.user-name {
  font-size: 13px;
  color: var(--subtext);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-logout {
  padding: 6px 12px;
  border-radius: 20px;
  background: var(--bg-overlay);
  color: var(--muted);
  font-size: 12px;
}

.btn-logout:hover {
  color: var(--red);
}

/* ── Content ── */
.content {
  flex: 1;
  overflow: hidden;
}

/* ── Bottom Tab Bar ── */
.tabbar {
  display: flex;
  justify-content: center;
  gap: 32px;
  height: 56px;
  padding: 0 24px;
  background: var(--bg-mantle);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 72px;
  padding: 6px 20px;
  border-radius: 12px;
  background: transparent;
  color: var(--muted);
  transition: all 0.2s;
}

.tab-btn:active {
  transform: scale(0.95);
}

.tab-icon {
  font-size: 20px;
  transition: transform 0.2s;
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.tab-btn.active {
  color: var(--accent);
  background: var(--bg-overlay);
}

.tab-btn.active .tab-icon {
  transform: scale(1.1);
}
</style>
