// "Forgot password": the person asks for a link by email, then sets a new password through it.
// Mounted from index.js:  passwordreset({ app, wrap, get, run, bcrypt })
// Needs: MAIL_FROM + (RESEND_API_KEY or BREVO_API_KEY), and CLIENT_ORIGIN (the website address the link points to).
import crypto from 'node:crypto';
import { sendMail, mailConfigured } from './mailer.js';

const HOUR = 36e5;
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const resetEmail = (name, link) => ({
  subject: 'Reset your EcoQuest password',
  text: `Hello ${name},\n\nSomeone asked to reset the password for your EcoQuest account. To choose a new password, open this link within 30 minutes:\n\n${link}\n\nIf you did not ask for this, you can ignore this email. Your password stays the same.\n`,
  html: `<p>Hello ${esc(name)},</p><p>Someone asked to reset the password for your EcoQuest account. To choose a new password, open this link within 30 minutes:</p><p><a href="${esc(link)}">Choose a new password</a></p><p>If you did not ask for this, you can ignore this email. Your password stays the same.</p>`,
});

export default function passwordreset({ app, wrap, get, run, bcrypt, env = process.env, send = sendMail, now = Date.now }) {
  const hits = new Map(); // "who" -> times of recent requests (kept in memory; fine for one server)
  const tooMany = (key, max) => { const t = now(), a = (hits.get(key) || []).filter(x => t - x < HOUR); if (a.length >= max) { hits.set(key, a); return true; } hits.set(key, [...a, t]); return false; };

  app.post('/api/auth/forgot', wrap(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/\S+@\S+/.test(email) || email.length > 200) return res.status(400).json({ error: 'Enter your email address' });
    const base = String(env.CLIENT_ORIGIN || '').trim().replace(/\/+$/, ''); // the link only ever points to YOUR website, never to an address the visitor supplied
    if (!mailConfigured(env) || !/^https?:\/\/[^\s,]+$/.test(base)) return res.status(503).json({ error: 'Password reset by email is not set up yet. Please ask your teacher or school.', code: 'not_configured' });
    if (tooMany('ip:' + req.ip, 10) || tooMany('email:' + email, 3)) return res.status(429).json({ error: 'Too many requests. Please wait an hour and try again.' });
    const u = await get('SELECT id,name FROM users WHERE email=?', email);
    if (u) {
      const token = crypto.randomBytes(32).toString('hex');
      await run('DELETE FROM password_resets WHERE user_id=? OR expires_at < NOW()', u.id); // one live link per person
      await run("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(?,?,NOW() + interval '30 minutes')", u.id, sha(token));
      send(env, { to: email, ...resetEmail(u.name, `${base}/reset-password/${token}`) }).catch(e => console.error('Reset email failed:', e.message)); // not awaited, so the answer takes the same time for every email
    }
    res.json({ ok: true }); // the same answer whether or not the email is registered
  }));

  app.post('/api/auth/reset', wrap(async (req, res) => {
    const { token, password } = req.body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'This reset link is not valid. Please ask for a new one.', code: 'bad_token' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 100) return res.status(400).json({ error: 'The new password needs 8 or more characters' });
    if (tooMany('reset:' + req.ip, 20)) return res.status(429).json({ error: 'Too many tries. Please wait an hour and try again.' });
    const r = await get('SELECT id,user_id FROM password_resets WHERE token_hash=? AND expires_at > NOW()', sha(token));
    const gone = r ? await run('DELETE FROM password_resets WHERE id=?', r.id) : null; // using the link removes it, so it works only once
    if (!r || !gone.rowCount) return res.status(400).json({ error: 'This reset link has expired or was already used. Please ask for a new one.', code: 'bad_token' });
    await run('UPDATE users SET password_hash=? WHERE id=?', bcrypt.hashSync(password, 10), r.user_id);
    res.json({ ok: true });
  }));
}
