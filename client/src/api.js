const BASE = import.meta.env.VITE_API || '';
export async function api(path, { method = 'GET', body, form } = {}) {
  const t = sessionStorage.getItem('token');
  const r = await fetch(BASE + '/api' + path, { method, headers: { ...(t && { Authorization: 'Bearer ' + t }), ...(body && { 'Content-Type': 'application/json' }) }, body: form || (body && JSON.stringify(body)) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'Something went wrong'); e.status = r.status; e.data = d; throw e; }
  return d;
}
export const img = p => (p ? BASE + p : null);

// CSV needs the login header, so a plain link cannot be used. Usage: await download('/classes/1/export.csv', 'class.csv')
export async function download(path, filename) {
  const t = sessionStorage.getItem('token');
  const r = await fetch(BASE + '/api' + path, { headers: t ? { Authorization: 'Bearer ' + t } : {} });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Download failed'); }
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
