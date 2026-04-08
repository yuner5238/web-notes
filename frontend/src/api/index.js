// 自动检测环境
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// 本地开发：API 请求到 localhost:5173 (Vite proxy) 或 localhost:3001
// 云端部署：API 请求到 /api (同域，由 Worker 处理)
const BASE = isLocal ? '/api' : '/api';

// Fetch wrapper with error handling
async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Notes API ──────────────────────────────────────────────────────────────

export async function listNotes() {
  const data = await api('/notes');
  return data.notes || [];
}

export async function getNote(key) {
  const data = await api('/notes/' + encodeURIComponent(key));
  return data.content || '';
}

export async function saveNote(key, content) {
  return api('/notes/' + encodeURIComponent(key), {
    method: 'PUT',
    body: { content },
  });
}

export async function deleteNote(key) {
  return api('/notes/' + encodeURIComponent(key), { method: 'DELETE' });
}

export async function createNote(name, content = '') {
  return api('/notes', { method: 'POST', body: { name, content } });
}

// ── Todos API ─────────────────────────────────────────────────────────────

export async function getTodoLists() {
  const data = await api('/todos/lists');
  return data.value || [];
}

export async function getTodos(listId) {
  const data = await api('/todos/' + encodeURIComponent(listId) + '/tasks');
  return data.value || [];
}

export async function createTodo(listId, title) {
  return api('/todos/' + encodeURIComponent(listId) + '/tasks', {
    method: 'POST',
    body: { title },
  });
}

export async function toggleTodo(listId, taskId, currentStatus) {
  const newStatus = currentStatus === 'completed' ? 'notStarted' : 'completed';
  return api('/todos/' + encodeURIComponent(listId) + '/tasks/' + taskId, {
    method: 'PATCH',
    body: { status: newStatus },
  });
}

export async function deleteTodo(listId, taskId) {
  return api('/todos/' + encodeURIComponent(listId) + '/tasks/' + taskId, { method: 'DELETE' });
}
