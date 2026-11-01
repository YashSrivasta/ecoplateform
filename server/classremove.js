// Remove a class for good (only the teacher who created it), or take a colleague's class off your own list.
// Students keep their points, levels, badges and streaks (those belong to the student, not the class).
// Mounted from index.js:  classremove({ app, T, own, wrap, all, get, run, tx })
import fs from 'node:fs/promises';
import path from 'node:path';

export default function classremove({ app, T, own, wrap, all, get, run, tx, unlink = fs.unlink, uploadsDir = path.resolve('uploads') }) {
  const count = async (sql, id) => Number((await get(sql, id)).n);

  // what will be deleted, shown to the teacher before they confirm
  app.get('/api/classes/:id/removal-info', T, own, wrap(async (req, res) => {
    const id = +req.params.id, c = await get('SELECT name FROM classes WHERE id=?', id);
    if (!c) return res.status(404).json({ error: 'Class not found' });
    res.json({ name: c.name,
      students: await count('SELECT COUNT(*) AS n FROM enrollments WHERE class_id=?', id),
      missions: await count('SELECT COUNT(*) AS n FROM missions WHERE class_id=?', id),
      photos: await count('SELECT COUNT(*) AS n FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE m.class_id=?', id),
      questions: await count('SELECT COUNT(*) AS n FROM quizzes WHERE class_id=?', id),
      announcements: await count('SELECT COUNT(*) AS n FROM announcements WHERE class_id=?', id),
      challenges: await count('SELECT COUNT(*) AS n FROM team_challenges WHERE class_id=?', id) });
  }));

  // delete the class and everything that belongs to it. The teacher must send the class name to confirm.
  app.post('/api/classes/:id/remove', T, own, wrap(async (req, res) => {
    const id = +req.params.id, c = await get('SELECT name FROM classes WHERE id=?', id);
    if (!c) return res.status(404).json({ error: 'Class not found' });
    if (String(req.body?.confirm || '').trim().toLowerCase() !== String(c.name).trim().toLowerCase()) return res.status(400).json({ error: 'Type the class name exactly to confirm' });
    const photos = (await all('SELECT s.photo FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE m.class_id=? AND s.photo IS NOT NULL', id)).map(r => r.photo);
    await tx(async x => { // children first, the class last; all or nothing
      await x('DELETE FROM team_challenges WHERE class_id=?', id); // its teams and members go with it
      await x('DELETE FROM announcements WHERE class_id=?', id);
      await x('DELETE FROM quiz_attempts WHERE quiz_id IN (SELECT id FROM quizzes WHERE class_id=?)', id);
      await x('DELETE FROM quizzes WHERE class_id=?', id);
      await x('DELETE FROM submissions WHERE mission_id IN (SELECT id FROM missions WHERE class_id=?)', id);
      await x('DELETE FROM missions WHERE class_id=?', id); // its subject tags go with it
      await x('DELETE FROM doubts WHERE class_id=?', id);
      await x('DELETE FROM project_classes WHERE class_id=?', id);
      await x('DELETE FROM class_viewers WHERE class_id=?', id);
      await x('DELETE FROM enrollments WHERE class_id=?', id);
      await x('DELETE FROM classes WHERE id=?', id);
    });
    for (const p of photos) { try { await unlink(path.join(uploadsDir, path.basename(p))); } catch { /* already gone */ } } // best effort, after the data is safely gone
    res.json({ ok: true, name: c.name });
  }));

  // a teacher takes a colleague's (view-only) class off their own list; nothing is deleted
  app.post('/api/classes/:id/leave-view', T, wrap(async (req, res) => {
    const r = await run('DELETE FROM class_viewers WHERE class_id=? AND teacher_id=?', /^\d{1,9}$/.test(req.params.id) ? +req.params.id : 0, req.user.id);
    r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'This class is not on your list as a view-only class' });
  }));
}
