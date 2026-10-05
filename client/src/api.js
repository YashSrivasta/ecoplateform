const BASE = import.meta.env.VITE_API || '';
export async function api(path, { method = 'GET', body, form } = {}) {
  const t = localStorage.getItem('token');
  const r = await fetch(BASE + '/api' + path, { method, headers: { ...(t && { Authorization: 'Bearer ' + t }), ...(body && { 'Content-Type': 'application/json' }) }, body: form || (body && JSON.stringify(body)) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
export const img = p => (p ? BASE + p : null);
