const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const sessions = {};

const {
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_TENANT_ID,
  MS_REDIRECT_URI,
  MS_SCOPES,
} = process.env;

// GET /api/auth/login
router.get('/login', (req, res) => {
  if (!MS_CLIENT_ID) {
    return res.redirect('http://localhost:5173/?ms_error=config_required');
  }
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MS_REDIRECT_URI,
    scope: MS_SCOPES,
    response_mode: 'query',
    state: Math.random().toString(36).slice(2),
  });
  res.redirect('https://login.microsoftonline.com/' + MS_TENANT_ID + '/oauth2/v2.0/authorize?' + params.toString());
});

// GET /api/auth/callback
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect('http://localhost:5173/?ms_error=' + encodeURIComponent(error));
  try {
    const body = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      code,
      redirect_uri: MS_REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: MS_SCOPES,
    });
    const resp = await fetch(
      'https://login.microsoftonline.com/' + MS_TENANT_ID + '/oauth2/v2.0/token',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
    );
    const data = await resp.json();
    if (data.error) return res.redirect('http://localhost:5173/?ms_error=' + encodeURIComponent(data.error_description || data.error));
    const sessionId = Math.random().toString(36).slice(2);
    sessions[sessionId] = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000 };
    res.cookie('session_id', sessionId, { httpOnly: true, maxAge: data.expires_in * 1000 });
    res.redirect('http://localhost:5173/?auth=ok');
  } catch (err) {
    console.error('[Auth Callback]', err);
    res.redirect('http://localhost:5173/?ms_error=auth_failed');
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const sessionId = req.cookies && req.cookies.session_id;
  if (!sessionId || !sessions[sessionId]) return res.status(401).json({ error: 'Not authenticated' });
  const { accessToken } = sessions[sessionId];
  if (!accessToken) return res.status(401).json({ error: 'No access token' });
  fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: 'Bearer ' + accessToken }
  })
    .then(r => r.json())
    .then(user => res.json(user))
    .catch(err => res.status(500).json({ error: err.message }));
});

// GET /api/auth/status
router.get('/status', (req, res) => {
  const sessionId = req.cookies && req.cookies.session_id;
  const session = sessionId && sessions[sessionId];
  if (session && Date.now() < session.expiresAt) {
    res.json({ authenticated: true, msConfigured: !!MS_CLIENT_ID });
  } else {
    res.json({ authenticated: false, msConfigured: !!MS_CLIENT_ID });
  }
});

// GET /api/auth/logout
router.get('/logout', (req, res) => {
  const sessionId = req.cookies && req.cookies.session_id;
  if (sessionId) delete sessions[sessionId];
  res.clearCookie('session_id');
  res.json({ success: true });
});

module.exports = router;
