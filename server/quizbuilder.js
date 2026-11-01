// Teacher quiz builder: a teacher writes questions for one of their own classes; only that class's students see them.
// Mounted from index.js:  quizbuilder({ app, T, own, view, wrap, all, get, run })
const MAX_PER_CLASS = 200;
const int = (v, lo, hi) => (/^\d{1,3}$/.test(String(v)) && +v >= lo && +v <= hi ? +v : null);

export default function quizbuilder({ app, T, own, view, wrap, all, get, run }) {
  // list a class's questions (any teacher who can view the class; the answer is included because teachers need it)
  app.get('/api/classes/:id/quizzes', T, view, wrap(async (req, res) => {
    const rows = await all(`SELECT q.id,q.difficulty,q.question,q.options,q.answer,q.grade_min,q.grade_max,s.slug AS subject,s.name AS subject_name,s.color,s.icon,
        (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id=q.id) AS attempts,
        (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id=q.id AND a.correct=1) AS right_count
      FROM quizzes q JOIN subjects s ON s.id=q.subject_id WHERE q.class_id=? AND NOT q.archived ORDER BY q.id DESC`, +req.params.id);
    res.json(rows.map(r => ({ ...r, options: JSON.parse(r.options) })));
  }));

  // add a question (only the teacher who created the class)
  app.post('/api/classes/:id/quizzes', T, own, wrap(async (req, res) => {
    const b = req.body || {}, cid = +req.params.id;
    const question = String(b.question || '').trim(), options = Array.isArray(b.options) ? b.options.map(o => String(o || '').trim()) : [];
    const difficulty = int(b.difficulty, 1, 5), gmin = int(b.grade_min ?? 1, 1, 20), gmax = int(b.grade_max ?? 20, 1, 20), answer = int(b.answer, 0, 3);
    if (question.length < 5 || question.length > 300) return res.status(400).json({ error: 'Write a question of 5 to 300 characters' });
    if (options.length < 2 || options.length > 4 || options.some(o => !o || o.length > 120)) return res.status(400).json({ error: 'Give 2 to 4 answer options, each up to 120 characters' });
    if (new Set(options.map(o => o.toLowerCase())).size !== options.length) return res.status(400).json({ error: 'Each answer option must be different' });
    if (answer === null || answer >= options.length) return res.status(400).json({ error: 'Mark which option is correct' });
    if (difficulty === null) return res.status(400).json({ error: 'Difficulty must be 1 to 5' });
    if (gmin === null || gmax === null || gmin > gmax) return res.status(400).json({ error: 'Choose a valid class range, for example 6 to 8' });
    const subj = await get('SELECT id FROM subjects WHERE slug=?', String(b.subject || ''));
    if (!subj) return res.status(400).json({ error: 'Pick a subject' });
    if ((await get('SELECT COUNT(*) AS n FROM quizzes WHERE class_id=? AND NOT archived', cid)).n >= MAX_PER_CLASS) return res.status(400).json({ error: `A class can have up to ${MAX_PER_CLASS} questions` });
    const r = await run('INSERT INTO quizzes(subject_id,grade_min,grade_max,difficulty,question,options,answer,class_id,created_by) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id',
      subj.id, gmin, gmax, difficulty, question, JSON.stringify(options), answer, cid, req.user.id);
    res.json({ ok: true, id: r.rows[0].id });
  }));

  // remove a question: hidden from students, but past answers and points stay
  app.delete('/api/classes/:id/quizzes/:qid', T, own, wrap(async (req, res) => {
    const r = await run('UPDATE quizzes SET archived=TRUE WHERE id=? AND class_id=? AND NOT archived', int(req.params.qid, 1, 999999999) ?? 0, +req.params.id);
    r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Question not found' });
  }));
}
