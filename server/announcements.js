// Announcements board: a teacher posts a notice to one of their own classes; students in that class read it.
// Mounted from index.js:  announcements({ app, S, T, own, view, wrap, all, get, run })
const idOf = v => (/^\d{1,9}$/.test(String(v)) ? +v : null);

export default function announcements({ app, S, T, own, view, wrap, all, get, run }) {
  // a class's notices (the class creator, or a colleague with view access)
  app.get('/api/classes/:id/announcements', T, view, wrap(async (req, res) => {
    res.json(await all('SELECT id,title,body,created_at FROM announcements WHERE class_id=? ORDER BY id DESC LIMIT 50', +req.params.id));
  }));

  // post a notice (only the teacher who created the class)
  app.post('/api/classes/:id/announcements', T, own, wrap(async (req, res) => {
    const title = String(req.body?.title || '').trim(), body = String(req.body?.body || '').trim();
    if (title.length < 3 || title.length > 100) return res.status(400).json({ error: 'Write a title of 3 to 100 characters' });
    if (body.length > 1000) return res.status(400).json({ error: 'The message can be up to 1000 characters' });
    const r = await run('INSERT INTO announcements(class_id,teacher_id,title,body) VALUES(?,?,?,?) RETURNING id', +req.params.id, req.user.id, title, body);
    res.json({ ok: true, id: r.rows[0].id });
  }));

  app.delete('/api/classes/:id/announcements/:aid', T, own, wrap(async (req, res) => {
    const r = await run('DELETE FROM announcements WHERE id=? AND class_id=?', idOf(req.params.aid) ?? 0, +req.params.id);
    r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Notice not found' });
  }));

  // what a student sees: the latest notices from every class they joined
  app.get('/api/student/announcements', S, wrap(async (req, res) => {
    res.json(await all(`SELECT a.id,a.title,a.body,a.created_at,c.name AS class_name,u.name AS teacher
      FROM announcements a JOIN enrollments e ON e.class_id=a.class_id AND e.student_id=? JOIN classes c ON c.id=a.class_id JOIN users u ON u.id=a.teacher_id
      ORDER BY a.id DESC LIMIT 10`, req.user.id));
  }));
}
