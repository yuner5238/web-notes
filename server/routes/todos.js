const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// In-memory token store
let msAccessToken = null;
let msRefreshToken = null;
let msTokenExpiry = null;

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const {
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_TENANT_ID,
} = process.env;

async function getGraphToken() {
  if (!msAccessToken || !msTokenExpiry || Date.now() >= msTokenExpiry - 60000) {
    await refreshMsToken();
  }
  return msAccessToken;
}

async function refreshMsToken() {
  if (!MS_CLIENT_SECRET) {
    msAccessToken = 'DEMO_MODE';
    return;
  }
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  });
  const resp = await fetch(
    'https://login.microsoftonline.com/' + MS_TENANT_ID + '/oauth2/v2.0/token',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
  );
  const data = await resp.json();
  if (data.access_token) {
    msAccessToken = data.access_token;
    msTokenExpiry = Date.now() + data.expires_in * 1000;
  }
}

async function graphRequest(path, options) {
  options = options || {};
  const token = await getGraphToken();
  if (token === 'DEMO_MODE') {
    return getMockData(path);
  }
  const resp = await fetch(GRAPH_BASE + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (resp.status === 204) return null;
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('Graph API error ' + resp.status + ': ' + err);
  }
  return resp.json();
}

function getMockData(path) {
  if (path.includes('/lists')) {
    return {
      value: [
        { id: 'mock-1', displayName: '事务', isOwner: true },
        { id: 'mock-2', displayName: '假期计划', isOwner: true },
      ]
    };
  }
  return {
    value: [
      { id: 't1', title: '订机票', status: 'completed', importance: 'normal', dueDateTime: null },
      { id: 't2', title: '写技术报告', status: 'notStarted', importance: 'high', dueDateTime: { dateTime: '2026-04-15T00:00:00', timeZone: 'Asia/Shanghai' } },
      { id: 't3', title: '练习英语', status: 'notStarted', importance: 'normal', dueDateTime: { dateTime: '2026-04-10T00:00:00', timeZone: 'Asia/Shanghai' } },
    ]
  };
}

// GET /api/todos/lists
router.get('/lists', async (req, res) => {
  try {
    const data = await graphRequest('/me/todo/lists');
    res.json(data);
  } catch (err) {
    console.error('[Todos Lists]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/todos/:listId/tasks
router.get('/:listId/tasks', async (req, res) => {
  try {
    const data = await graphRequest('/me/todo/lists/' + req.params.listId + '/tasks');
    res.json(data);
  } catch (err) {
    console.error('[Todos Tasks]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos/:listId/tasks
router.post('/:listId/tasks', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const data = await graphRequest('/me/todo/lists/' + req.params.listId + '/tasks', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    res.json(data);
  } catch (err) {
    console.error('[Todos Create]', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/todos/:listId/tasks/:taskId
router.patch('/:listId/tasks/:taskId', async (req, res) => {
  try {
    const { status } = req.body;
    const data = await graphRequest(
      '/me/todo/lists/' + req.params.listId + '/tasks/' + req.params.taskId,
      { method: 'PATCH', body: JSON.stringify({ status }) }
    );
    res.json(data);
  } catch (err) {
    console.error('[Todos Patch]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/:listId/tasks/:taskId
router.delete('/:listId/tasks/:taskId', async (req, res) => {
  try {
    await graphRequest(
      '/me/todo/lists/' + req.params.listId + '/tasks/' + req.params.taskId,
      { method: 'DELETE' }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Todos Delete]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
