// Sends one email through a free email service's web API (Render's free plan blocks normal mail ports, so SMTP is not used).
// Set MAIL_FROM plus either RESEND_API_KEY or BREVO_API_KEY. With none of them set, email is simply off.
export const mailConfigured = env => Boolean(env.MAIL_FROM && (env.RESEND_API_KEY || env.BREVO_API_KEY));

// "EcoQuest <hello@school.org>" -> {name, email};  "hello@school.org" -> {name: 'EcoQuest', email}
export function parseFrom(from) {
  const m = String(from).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || 'EcoQuest', email: m[2].trim() } : { name: 'EcoQuest', email: String(from).trim() };
}

export async function sendMail(env, { to, subject, text, html }, fetchFn = globalThis.fetch) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const resp = env.RESEND_API_KEY
      ? await fetchFn('https://api.resend.com/emails', { method: 'POST', signal: ctl.signal, headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text, html }) })
      : await fetchFn('https://api.brevo.com/v3/smtp/email', { method: 'POST', signal: ctl.signal, headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ sender: parseFrom(env.MAIL_FROM), to: [{ email: to }], subject, textContent: text, htmlContent: html }) });
    if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(`email service answered ${resp.status} ${d.message || d.error?.message || ''}`.trim()); }
  } finally { clearTimeout(timer); }
}
