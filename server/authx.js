// Stage 4a: login rate limit + Google sign-in.  Mounted from index.js:  authx({ app, wrap, get, run, bcrypt, token, pub })
import crypto from 'node:crypto';

const WINDOW = `interval '15 minutes'`;
const LIMIT_PAIR = 8, LIMIT_IP = 100; // failed logins per 15 min: per (email + address), and per address (a whole school may share one)

export default function authx({ app, wrap, get, run, bcrypt, token, pub }) {
  const ipOf = req => String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
  // seconds until the block lifts, or 0 when not blocked
  const waitFor = async keys => {
    for (const [key, limit] of keys) {
      const r = await get(`SELECT count, CEIL(EXTRACT(EPOCH FROM (window_start + ${WINDOW} - NOW())))::int AS wait FROM login_attempts WHERE key=? AND window_start > NOW() - ${WINDOW}`, key);
      if (r && r.count >= limit) return Math.max(1, r.wait);
    }
    return 0;
  };
  const recordFailure = async keys => {
    for (const [key] of keys) await run(`INSERT INTO login_attempts(key,count,window_start) VALUES(?,1,NOW()) ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN login_attempts.window_start < NOW() - ${WINDOW} THEN 1 ELSE login_attempts.count + 1 END,
      window_start = CASE WHEN login_attempts.window_start < NOW() - ${WINDOW} THEN NOW() ELSE login_attempts.window_start END`, key);
    if (Math.random() < 0.02) await run(`DELETE FROM login_attempts WHERE window_start < NOW() - interval '1 day'`); // housekeeping
  };
  const tooMany = (res, wait) => { res.set('Retry-After', String(wait)); return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`, retry_after: wait }); };
  const wrongRole = (u, res) => res.status(403).json({ error: `This is a ${u.role} account. Use the ${u.role} login.` });

  app.get('/api/auth/config', (_req, res) => res.json({ google: Boolean(process.env.GOOGLE_CLIENT_ID) }));

  app.post('/api/auth/login', wrap(async (req, res) => {
    const { email, password, role } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254) return res.status(400).json({ error: 'Email and password required' });
    const em = email.toLowerCase(), ip = ipOf(req), pair = ['p:' + em + '|' + ip, LIMIT_PAIR], keys = [pair, ['i:' + ip, LIMIT_IP]];
    const wait = await waitFor(keys); if (wait) return tooMany(res, wait); // checked before the password, so guessing while blocked gains nothing
    const u = await get('SELECT * FROM users WHERE email=?', em);
    if (!u || !bcrypt.compareSync(password, u.password_hash)) { await recordFailure(keys); return res.status(401).json({ error: 'Wrong email or password' }); }
    if (u.role !== role) return wrongRole(u, res); // correct password, so not counted as a failure
    await run('DELETE FROM login_attempts WHERE key=?', pair[0]);
    res.json({ token: token(u), user: pub(u) });
  }));

  // ---------- Google sign-in (set GOOGLE_CLIENT_ID on the server) ----------
  let client;
  app.post('/api/auth/google', wrap(async (req, res) => {
    const cid = process.env.GOOGLE_CLIENT_ID; if (!cid) return res.status(501).json({ error: 'Google sign-in is not set up yet' });
    const { credential, role, grade } = req.body || {};
    if (typeof credential !== 'string' || !['student', 'teacher'].includes(role)) return res.status(400).json({ error: 'Choose student or teacher, then continue with Google' });
    const keys = [['i:' + ipOf(req), LIMIT_IP]], wait = await waitFor(keys); if (wait) return tooMany(res, wait);
    let p;
    try { client ||= new (await import('google-auth-library')).OAuth2Client(cid); p = (await client.verifyIdToken({ idToken: credential, audience: cid })).getPayload(); }
    catch { await recordFailure(keys); return res.status(401).json({ error: 'Google sign-in failed. Please try again.' }); }
    if (!p?.sub || !p.email || p.email_verified !== true) return res.status(401).json({ error: 'Your Google email is not verified' });
    const em = p.email.toLowerCase();
    let u = await get('SELECT * FROM users WHERE google_id=?', p.sub);
    if (!u) {
      const taken = 'An account with this email already exists. Log in with your password.';
      // An existing password account is never linked automatically: nothing here proves the person who first registered that email owns it.
      const same = await get('SELECT * FROM users WHERE email=?', em);
      if (same && same.google_id !== p.sub) return res.status(409).json({ error: taken });
      u = same; // same Google identity: a parallel request (double tap) created the account a moment ago
      if (!u) {
        if (role === 'student' && !(grade >= 1 && grade <= 20)) return res.status(400).json({ error: 'Enter your class/grade (1-12, college 13+)', needs_grade: true });
        const name = String(p.name || em.split('@')[0]).trim().slice(0, 100) || 'Student';
        try { u = (await run('INSERT INTO users(role,name,email,password_hash,grade,google_id) VALUES(?,?,?,?,?,?) RETURNING *', role, name, em, bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10), role === 'student' ? +grade : null, p.sub)).rows[0]; }
        catch (e) { if (e.code !== '23505') throw e; u = await get('SELECT * FROM users WHERE google_id=?', p.sub); if (!u) return res.status(409).json({ error: taken }); } // both passed the check above at once
      }
    }
    if (u.role !== role) return wrongRole(u, res);
    res.json({ token: token(u), user: pub(u) });
  }));
}
