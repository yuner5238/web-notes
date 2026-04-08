export async function getAuthStatus() {
  const res = await fetch('/api/auth/status', { credentials: 'include' });
  return res.json();
}

export async function login() {
  window.location.href = '/api/auth/login';
}

export async function logout() {
  await fetch('/api/auth/logout', { credentials: 'include' });
  window.location.reload();
}

export async function getCurrentUser() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
}
