<template>
  <div class="todo-panel">
    <div class="todo-header">
      <span class="todo-icon">☑</span>
      <h2>待办事项</h2>
    </div>

    <div v-if="!isLoggedIn" class="login-prompt">
      <div class="login-icon">🔒</div>
      <p>需要登录微软账号才能使用<br><small style="color:var(--muted)">（未配置时显示演示数据）</small></p>
      <button class="btn-primary" @click="handleLogin">立即登录</button>
    </div>

    <template v-else>
      <div v-if="loading" class="todo-loading">加载中...</div>
      <div v-else-if="lists.length === 0" class="todo-empty">
        <p>暂无待办列表，请在 Microsoft To Do 应用中创建</p>
      </div>
      <div v-else class="todo-content">
        <div v-for="list in lists" :key="list.id" class="todo-section">
          <div class="section-header" @click="toggle(list.id)">
            <span class="chevron" :class="{ open: expanded[list.id] }">▶</span>
            <span class="section-name">{{ list.displayName }}</span>
            <span class="section-count">{{ (tasks[list.id] || []).length }}</span>
          </div>
          <div v-if="expanded[list.id] !== false" class="section-body">
            <div class="add-row">
              <input
                v-model="newTask[list.id]"
                @keydown.enter="addTask(list.id)"
                placeholder="添加任务..."
              />
              <button class="btn-add" @click="addTask(list.id)">+</button>
            </div>
            <div
              v-for="task in (tasks[list.id] || [])"
              :key="task.id"
              class="todo-item"
              :class="{ done: task.status === 'completed' }"
              @click="toggleTask(list.id, task)"
            >
              <span class="checkbox">{{ task.status === 'completed' ? '✓' : '' }}</span>
              <span class="task-title">{{ task.title }}</span>
              <span v-if="task.importance === 'high'" class="priority-dot red" />
              <span v-if="task.dueDateTime" class="due" :class="{ overdue: isOverdue(task.dueDateTime) }">
                {{ formatDue(task.dueDateTime) }}
              </span>
              <button class="task-del" @click.stop="removeTask(list.id, task.id)" title="删除">✕</button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getTodoLists, getTodos, createTodo, toggleTodo, deleteTodo } from '../api/index.js'
import { login } from '../api/auth.js'

const props = defineProps({ isLoggedIn: Boolean })

const lists = ref([])
const tasks = ref({})
const expanded = ref({})
const newTask = ref({})
const loading = ref(true)

onMounted(async () => {
  if (!props.isLoggedIn) { loading.value = false; return }
  await loadAll()
})

async function loadAll() {
  loading.value = true
  try {
    lists.value = await getTodoLists()
    const t = {}
    for (const list of lists.value) {
      t[list.id] = await getTodos(list.id)
      if (expanded.value[list.id] === undefined) expanded.value[list.id] = true
    }
    tasks.value = t
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

function toggle(id) {
  expanded.value[id] = !expanded.value[id]
}

async function addTask(listId) {
  const title = (newTask.value[listId] || '').trim()
  if (!title) return
  try {
    await createTodo(listId, title)
    newTask.value[listId] = ''
    tasks.value[listId] = await getTodos(listId)
  } catch (e) { console.error(e) }
}

async function toggleTask(listId, task) {
  try {
    await toggleTodo(listId, task.id, task.status)
    tasks.value[listId] = await getTodos(listId)
  } catch (e) { console.error(e) }
}

async function removeTask(listId, taskId) {
  try {
    await deleteTodo(listId, taskId)
    tasks.value[listId] = await getTodos(listId)
  } catch (e) { console.error(e) }
}

function handleLogin() { login() }

function isOverdue(due) {
  if (!due || !due.dateTime) return false
  return new Date(due.dateTime) < new Date()
}

function formatDue(due) {
  if (!due || !due.dateTime) return ''
  const d = new Date(due.dateTime)
  const now = new Date()
  const diff = Math.floor((d - now) / 86400000)
  if (diff < 0) return '已过期'
  if (diff === 0) return '今天'
  return (d.getMonth()+1) + '月' + d.getDate() + '日'
}
</script>

<style scoped>
.todo-panel { display: flex; flex-direction: column; height: 100%; background: var(--bg-surface); }
.todo-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; color: var(--accent); }
.todo-header h2 { font-size: 14px; font-weight: 600; color: var(--text); }
.todo-icon { font-size: 20px; }

.login-prompt { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 30px; text-align: center; }
.login-icon { font-size: 48px; opacity: .4; }
.login-prompt p { font-size: 13px; color: var(--muted); line-height: 1.6; }
.btn-primary { padding: 8px 20px; background: var(--accent); color: #11111b; border-radius: var(--radius); font-size: 13px; font-weight: 600; }
.btn-primary:hover { background: var(--accent-hover); }

.todo-loading, .todo-empty { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--muted); }
.todo-empty p { text-align: center; padding: 0 20px; }
.todo-content { flex: 1; overflow-y: auto; padding: 8px 0; }
.todo-section { margin-bottom: 4px; }
.section-header { display: flex; align-items: center; padding: 6px 14px; cursor: pointer; gap: 6px; user-select: none; }
.section-header:hover { background: var(--bg-overlay); }
.chevron { color: var(--muted); font-size: 10px; transition: transform .15s; }
.chevron.open { transform: rotate(90deg); }
.section-name { flex: 1; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.section-count { background: var(--bg-overlay); color: var(--muted); border-radius: 10px; padding: 0 6px; font-size: 11px; min-width: 20px; text-align: center; }
.add-row { display: flex; align-items: center; padding: 4px 14px; gap: 8px; }
.add-row input { flex: 1; font-size: 13px; }
.btn-add { width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--accent); color: #11111b; font-size: 18px; line-height: 1; font-weight: 700; flex-shrink: 0; }
.btn-add:hover { background: var(--accent-hover); }
.todo-item { display: flex; align-items: center; padding: 6px 14px; gap: 8px; cursor: pointer; transition: background .1s; }
.todo-item:hover { background: var(--bg-overlay); }
.todo-item.done .task-title { color: var(--muted); text-decoration: line-through; }
.checkbox { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: all .15s; color: transparent; }
.todo-item.done .checkbox { background: var(--green); border-color: var(--green); color: #11111b; }
.task-title { flex: 1; font-size: 13px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.priority-dot.red { width: 6px; height: 6px; border-radius: 50%; background: var(--red); flex-shrink: 0; }
.due { font-size: 11px; color: var(--muted); flex-shrink: 0; }
.due.overdue { color: var(--red); }
.task-del { opacity: 0; width: 22px; height: 22px; border-radius: var(--radius-sm); background: transparent; color: var(--muted); display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
.todo-item:hover .task-del { opacity: 1; }
.task-del:hover { background: var(--red); color: #fff; }
</style>
