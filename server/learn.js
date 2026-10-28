// Stage 2: subjects, quiz hub, streaks, daily challenges.  Mounted from index.js:  learn({ app, auth, S, needClass, wrap, all, get, run, tx })
import { today, band, BANDS, badgesBetween, touchStreak, streakOf, TZ } from './shared.js';

export default function learn({ app, auth, S, needClass, wrap, all, get, run, tx }) {
  const subjects = () => all('SELECT id,slug,name,color,icon FROM subjects ORDER BY id');
  const sum = async (x, id) => (await x('SELECT COALESCE(SUM(points),0) AS p FROM activity WHERE student_id=?', id)).rows[0].p;
  const pickChoice = (raw, options) => { const c = Number(raw); return Number.isInteger(c) && c >= 0 && c < options.length ? c : null; };

  // The challenge is shared by everyone in the same grade band, and picked once per (day, subject, band).
  async function dailyQuiz(day, subj, b) {
    let r = await get('SELECT quiz_id FROM daily_challenges WHERE day=?::date AND subject_id=? AND grade_band=?', day, subj.id, b);
    if (!r) {
      const qs = await all('SELECT id FROM quizzes WHERE subject_id=? AND ? BETWEEN grade_min AND grade_max ORDER BY id', subj.id, BANDS[b][0]);
      if (!qs.length) return null;
      const pick = qs[Math.floor(Date.parse(day + 'T00:00:00Z') / 864e5) % qs.length].id; // rotates through the bank day by day
      await run('INSERT INTO daily_challenges(day,subject_id,quiz_id,grade_band) VALUES(?::date,?,?,?) ON CONFLICT DO NOTHING', day, subj.id, pick, b);
      r = await get('SELECT quiz_id FROM daily_challenges WHERE day=?::date AND subject_id=? AND grade_band=?', day, subj.id, b);
    }
    return get('SELECT id,difficulty,question,options,answer FROM quizzes WHERE id=?', r.quiz_id);
  }
  const doneToday = (x, sid, subjId, t) => x(`SELECT points FROM activity WHERE student_id=? AND subject_id=? AND kind='daily' AND (created_at AT TIME ZONE ?::text)::date=?::date LIMIT 1`, sid, subjId, TZ, t);

  // ---------- subjects (students and teachers) ----------
  app.get('/api/subjects', auth(), wrap(async (_req, res) => res.json(await subjects())));

  // ---------- quiz hub ----------
  app.get('/api/quizzes', S, needClass, wrap(async (req, res) => {
    const g = (await get('SELECT grade FROM users WHERE id=?', req.user.id)).grade, slug = req.query.subject || null;
    const rows = await all(`SELECT q.id,q.difficulty,q.question,q.options,a.correct,s.slug AS subject,s.name AS subject_name,s.color,s.icon
      FROM quizzes q JOIN subjects s ON s.id=q.subject_id LEFT JOIN quiz_attempts a ON a.quiz_id=q.id AND a.student_id=?
      WHERE ? BETWEEN q.grade_min AND q.grade_max AND (?::text IS NULL OR s.slug=?) ORDER BY s.id,q.difficulty,q.id`, req.user.id, g, slug, slug);
    res.json(rows.map(x => ({ ...x, options: JSON.parse(x.options) })));
  }));

  app.post('/api/quizzes/:id/answer', S, needClass, wrap(async (req, res) => {
    const z = Number.isInteger(+req.params.id) ? await get('SELECT * FROM quizzes WHERE id=?', +req.params.id) : null;
    if (!z) return res.status(404).json({ error: 'Quiz not found' });
    const choice = pickChoice(req.body.choice, JSON.parse(z.options)); if (choice === null) return res.status(400).json({ error: 'Pick one of the options' });
    const ok = choice === z.answer, pts = ok ? z.difficulty * 5 : 0, id = req.user.id; let out;
    try {
      await tx(async x => {
        const before = await sum(x, id);
        await x('INSERT INTO quiz_attempts(student_id,quiz_id,correct,points) VALUES(?,?,?,?)', id, z.id, ok ? 1 : 0, pts); // primary key blocks a second answer, even a racing one
        if (ok) await x('INSERT INTO activity(student_id,kind,text,points,subject_id) VALUES(?,?,?,?,?)', id, 'quiz', 'Correct quiz answer', pts, z.subject_id);
        out = { streak: await touchStreak(x, id), newBadges: badgesBetween(before, before + pts) };
      });
    } catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'Already answered' }); throw e; }
    res.json({ correct: ok, answer: z.answer, points: pts, ...out });
  }));

  // ---------- streak ----------
  app.get('/api/student/streak', S, wrap(async (req, res) => res.json(await streakOf(get, req.user.id))));

  // ---------- daily challenges: one per subject per day, double points ----------
  app.get('/api/daily', S, needClass, wrap(async (req, res) => {
    const t = today(), b = band((await get('SELECT grade FROM users WHERE id=?', req.user.id)).grade), list = [];
    for (const s of await subjects()) {
      const z = await dailyQuiz(t, s, b); if (!z) continue;
      const d = (await doneToday(run, req.user.id, s.id, t)).rows[0];
      list.push({ subject: s.slug, name: s.name, color: s.color, icon: s.icon, done: !!d, earned: d ? d.points : null, max_points: z.difficulty * 10,
        quiz: d ? null : { id: z.id, difficulty: z.difficulty, question: z.question, options: JSON.parse(z.options) } }); // the answer is never sent
    }
    res.json({ day: t, streak: await streakOf(get, req.user.id), challenges: list });
  }));

  app.post('/api/daily/:slug/answer', S, needClass, wrap(async (req, res) => {
    const s = await get('SELECT * FROM subjects WHERE slug=?', req.params.slug); if (!s) return res.status(404).json({ error: 'Unknown subject' });
    const t = today(), id = req.user.id, z = await dailyQuiz(t, s, band((await get('SELECT grade FROM users WHERE id=?', id)).grade));
    if (!z) return res.status(404).json({ error: 'No challenge for this subject yet' });
    const choice = pickChoice(req.body.choice, JSON.parse(z.options)); if (choice === null) return res.status(400).json({ error: 'Pick one of the options' });
    const ok = choice === z.answer, pts = ok ? z.difficulty * 10 : 0; let out = null;
    await tx(async x => {
      await x('SELECT pg_advisory_xact_lock(?,?)', id, s.id); // two quick taps cannot both pass the check below
      if ((await doneToday(x, id, s.id, t)).rowCount) return;
      const before = await sum(x, id);
      await x('INSERT INTO quiz_attempts(student_id,quiz_id,correct,points,is_daily) VALUES(?,?,?,?,TRUE) ON CONFLICT DO NOTHING', id, z.id, ok ? 1 : 0, pts);
      await x('INSERT INTO activity(student_id,kind,text,points,subject_id) VALUES(?,?,?,?,?)', id, 'daily', `Daily challenge: ${s.name}${ok ? ' (2x)' : ''}`, pts, s.id);
      out = { streak: await touchStreak(x, id), newBadges: badgesBetween(before, before + pts) };
    });
    if (!out) return res.status(409).json({ error: 'You already played this daily challenge' });
    res.json({ correct: ok, answer: z.answer, points: pts, ...out });
  }));
}
