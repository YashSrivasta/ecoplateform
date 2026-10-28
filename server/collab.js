// Stage 4b: cross-class projects (with invites), class comparison, student portfolio, CSV export.
// Mounted from index.js:  collab({ app, S, T, view, wrap, all, get, run, tx })
import { today, addDays, TZ, BADGES, streakOf } from './shared.js';
import { parseMission, insertMission } from './insight.js';

const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
const intParam = v => (/^\d{1,9}$/.test(String(v)) ? +v : null);
// Excel treats a cell starting with = + - @ as a formula, and names are typed by users, so text cells get a leading apostrophe.
const cell = v => { if (v == null) return ''; let s = String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (head, rows) => '﻿' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n'; // BOM so Excel reads UTF-8 names correctly
const sendCsv = (res, name, text) => { res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', `attachment; filename="${name}"`); res.send(text); };
const dayOf = d => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }) : '');

export default function collab({ app, S, T, view, wrap, all, get, run, tx }) {
  const SUBJ = `(SELECT COALESCE(json_agg(json_build_object('slug',s.slug,'name',s.name,'color',s.color,'icon',s.icon) ORDER BY s.id),'[]'::json) FROM mission_subjects ms JOIN subjects s ON s.id=ms.subject_id WHERE ms.mission_id=m.id) AS subjects`;
  const member = (pid, tid, accepted) => get(`SELECT 1 FROM project_classes pc JOIN classes c ON c.id=pc.class_id WHERE pc.project_id=? AND c.teacher_id=?${accepted ? " AND pc.status='accepted'" : ''}`, pid, tid);
  const classesOf = pid => all(`SELECT c.id AS class_id,c.name AS class,t.name AS teacher,pc.status FROM project_classes pc JOIN classes c ON c.id=pc.class_id JOIN users t ON t.id=c.teacher_id WHERE pc.project_id=? ORDER BY pc.class_id`, pid);

  // ================= projects =================
  app.post('/api/projects', T, wrap(async (req, res) => {
    const { title, description, class_id } = req.body || {}, cid = intParam(class_id);
    if (typeof title !== 'string' || !title.trim() || title.length > 120) return res.status(400).json({ error: 'Give the project a title (up to 120 characters)' });
    if (!cid || !(await get('SELECT 1 FROM classes WHERE id=? AND teacher_id=?', cid, req.user.id))) return res.status(403).json({ error: 'Pick one of your own classes' });
    let id;
    await tx(async x => {
      id = (await x('INSERT INTO projects(title,description,owner_id) VALUES(?,?,?) RETURNING id', title.trim(), String(description || '').slice(0, 1000), req.user.id)).rows[0].id;
      await x(`INSERT INTO project_classes(project_id,class_id,status,invited_by,responded_at) VALUES(?,?,'accepted',?,NOW())`, id, cid, req.user.id);
    });
    res.json({ id });
  }));

  app.post('/api/projects/:id/invite', T, wrap(async (req, res) => {
    const pid = intParam(req.params.id); if (!pid || !(await member(pid, req.user.id, true))) return res.status(403).json({ error: 'Only a teacher with an accepted class in this project can invite' });
    const c = await get('SELECT id,name,teacher_id FROM classes WHERE code=?', String(req.body?.code || '').trim().toUpperCase()); if (!c) return res.status(404).json({ error: 'No class with that code' });
    const ex = await get('SELECT status FROM project_classes WHERE project_id=? AND class_id=?', pid, c.id);
    if (ex && ex.status !== 'declined') return res.status(409).json({ error: ex.status === 'accepted' ? 'That class is already in this project' : 'An invite to that class is already waiting' });
    const status = c.teacher_id === req.user.id ? 'accepted' : 'pending'; // your own classes need no approval; another teacher's class must accept
    const r = await run(`INSERT INTO project_classes(project_id,class_id,status,invited_by,responded_at) VALUES(?,?,?,?,CASE WHEN ?::text='accepted' THEN NOW() END)
      ON CONFLICT(project_id,class_id) DO UPDATE SET status=EXCLUDED.status,invited_by=EXCLUDED.invited_by,responded_at=EXCLUDED.responded_at WHERE project_classes.status='declined' RETURNING class_id`, pid, c.id, status, req.user.id, status);
    if (!r.rows.length) return res.status(409).json({ error: 'That class was just added or invited' }); // lost a race with another request
    res.json({ ok: true, status, class: c.name });
  }));

  app.post('/api/projects/:id/respond', T, wrap(async (req, res) => {
    const pid = intParam(req.params.id), cid = intParam(req.body?.class_id), accept = req.body?.accept;
    if (!pid || !cid || typeof accept !== 'boolean') return res.status(400).json({ error: 'Send class_id and accept (true or false)' });
    if (!(await get('SELECT 1 FROM project_classes pc JOIN classes c ON c.id=pc.class_id WHERE pc.project_id=? AND pc.class_id=? AND c.teacher_id=?', pid, cid, req.user.id))) return res.status(403).json({ error: 'Only the teacher of the invited class can answer' });
    const r = await run(`UPDATE project_classes SET status=?,responded_at=NOW() WHERE project_id=? AND class_id=? AND status='pending' RETURNING class_id`, accept ? 'accepted' : 'declined', pid, cid);
    if (!r.rows.length) return res.status(409).json({ error: 'This invite was already answered' });
    res.json({ ok: true, status: accept ? 'accepted' : 'declined' });
  }));

  // A teacher posts a project mission into their OWN accepted class. That class's own teacher reviews their own students.
  app.post('/api/projects/:id/missions', T, wrap(async (req, res) => {
    const pid = intParam(req.params.id), cid = intParam(req.body?.class_id);
    if (!pid || !cid) return res.status(400).json({ error: 'Send class_id' });
    if (!(await get('SELECT 1 FROM classes WHERE id=? AND teacher_id=?', cid, req.user.id))) return res.status(403).json({ error: 'You can only post to your own class' });
    if (!(await get(`SELECT 1 FROM project_classes WHERE project_id=? AND class_id=? AND status='accepted'`, pid, cid))) return res.status(403).json({ error: 'This class has not joined that project' });
    const m = await parseMission(req.body, all, get); if (m.error) return res.status(400).json({ error: m.error });
    let id; await tx(async x => { id = await insertMission(x, cid, m, pid); });
    res.json({ ok: true, id });
  }));

  app.get('/api/projects', T, wrap(async (req, res) => {
    const ps = await all(`SELECT p.id,p.title,p.description,p.created_at,u.name AS owner,(p.owner_id=?) AS mine FROM projects p JOIN users u ON u.id=p.owner_id
      WHERE p.id IN (SELECT pc.project_id FROM project_classes pc JOIN classes c ON c.id=pc.class_id WHERE c.teacher_id=?) ORDER BY p.id DESC`, req.user.id, req.user.id);
    const mineIds = new Set((await all('SELECT id FROM classes WHERE teacher_id=?', req.user.id)).map(c => c.id));
    for (const p of ps) { p.classes = (await classesOf(p.id)).map(c => ({ ...c, mine: mineIds.has(c.class_id) })); p.invites_for_me = p.classes.filter(c => c.mine && c.status === 'pending'); }
    res.json(ps);
  }));

  app.get('/api/projects/:id', T, wrap(async (req, res) => {
    const pid = intParam(req.params.id); if (!pid || !(await member(pid, req.user.id))) return res.status(403).json({ error: 'You are not part of this project' });
    const p = await get('SELECT p.id,p.title,p.description,p.created_at,u.name AS owner FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.id=?', pid);
    const mineIds = new Set((await all('SELECT id FROM classes WHERE teacher_id=?', req.user.id)).map(c => c.id));
    p.classes = (await classesOf(pid)).map(c => ({ ...c, mine: mineIds.has(c.class_id) }));
    // Progress is shown only to teachers whose own class has accepted, and only as totals per class: no other class's student names.
    p.progress = (await member(pid, req.user.id, true)) ? await all(`SELECT c.id AS class_id,c.name AS class,
        (SELECT COUNT(*) FROM enrollments e WHERE e.class_id=c.id) AS students,
        (SELECT COUNT(*) FROM missions m WHERE m.class_id=c.id AND m.project_id=?) AS missions,
        (SELECT COUNT(*) FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE m.class_id=c.id AND m.project_id=? AND s.status='approved') AS approved,
        (SELECT COALESCE(SUM(s.awarded),0) FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE m.class_id=c.id AND m.project_id=? AND s.status='approved') AS points
      FROM project_classes pc JOIN classes c ON c.id=pc.class_id WHERE pc.project_id=? AND pc.status='accepted' ORDER BY c.id`, pid, pid, pid, pid) : null;
    res.json(p);
  }));

  app.get('/api/student/projects', S, wrap(async (req, res) => {
    const rows = await all(`SELECT p.id,p.title,p.description,c.id AS class_id,c.name AS class_name FROM enrollments e JOIN classes c ON c.id=e.class_id
      JOIN project_classes pc ON pc.class_id=c.id AND pc.status='accepted' JOIN projects p ON p.id=pc.project_id WHERE e.student_id=? ORDER BY p.id DESC`, req.user.id);
    for (const r of rows) {
      r.partner_classes = (await all(`SELECT c.name FROM project_classes pc JOIN classes c ON c.id=pc.class_id WHERE pc.project_id=? AND pc.status='accepted' AND pc.class_id<>? ORDER BY c.id`, r.id, r.class_id)).map(c => c.name);
      r.missions = await all(`SELECT m.id,m.title,m.points,m.deadline,${SUBJ},(SELECT status FROM submissions s WHERE s.mission_id=m.id AND s.student_id=? ORDER BY s.id DESC LIMIT 1) AS status
        FROM missions m WHERE m.class_id=? AND m.project_id=? ORDER BY m.id DESC`, req.user.id, r.class_id, r.id);
    }
    res.json(rows);
  }));

  // ================= reports =================
  async function metrics(c, subs) {
    const cid = c.id, y = addDays(today(), -1);
    const n = (await get('SELECT COUNT(*) AS n FROM enrollments WHERE class_id=?', cid)).n;
    const pts = (await get('SELECT COALESCE(SUM(a.points),0) AS p FROM activity a JOIN enrollments e ON e.student_id=a.student_id AND e.class_id=?', cid)).p;
    const acc = await get('SELECT COUNT(*) AS attempts, COUNT(*) FILTER (WHERE t.correct=1) AS correct FROM quiz_attempts t JOIN enrollments e ON e.student_id=t.student_id AND e.class_id=?', cid);
    const active = (await get(`SELECT COUNT(*) AS n FROM enrollments e WHERE e.class_id=? AND (
      EXISTS(SELECT 1 FROM activity a WHERE a.student_id=e.student_id AND a.created_at > NOW() - interval '7 days') OR EXISTS(SELECT 1 FROM quiz_attempts t WHERE t.student_id=e.student_id AND t.created_at > NOW() - interval '7 days'))`, cid)).n;
    const ms = await get(`WITH latest AS (SELECT DISTINCT ON (s.mission_id,s.student_id) s.mission_id,s.status FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE m.class_id=? ORDER BY s.mission_id,s.student_id,s.id DESC)
      SELECT (SELECT COUNT(*) FROM missions WHERE class_id=?) AS missions, COUNT(*) FILTER (WHERE status='approved') AS approved FROM latest`, cid, cid);
    const st = await get('SELECT COALESCE(AVG(CASE WHEN s.last_day >= ?::date THEN s.current ELSE 0 END),0) AS a FROM enrollments e LEFT JOIN streaks s ON s.student_id=e.student_id WHERE e.class_id=?', y, cid);
    const sa = await all(`SELECT q.subject_id, COUNT(*) AS attempts, COUNT(*) FILTER (WHERE t.correct=1) AS correct FROM quiz_attempts t JOIN quizzes q ON q.id=t.quiz_id JOIN enrollments e ON e.student_id=t.student_id AND e.class_id=? GROUP BY 1`, cid);
    return { class_id: cid, name: c.name, students: n, avg_points: n ? Math.round(pts / n) : 0, quiz_attempts: acc.attempts, accuracy: pct(acc.correct, acc.attempts), active_rate: pct(active, n),
      mission_rate: pct(ms.approved, ms.missions * n), avg_streak: Math.round(st.a * 10) / 10,
      subjects: Object.fromEntries(subs.map(s => { const r = sa.find(x => x.subject_id === s.id); return [s.slug, r ? pct(r.correct, r.attempts) : null]; })) };
  }

  app.get('/api/reports/class-comparison', T, wrap(async (req, res) => {
    let rows = await all('SELECT c.id,c.name FROM classes c WHERE c.teacher_id=? OR c.id IN (SELECT class_id FROM class_viewers WHERE teacher_id=?) ORDER BY c.id', req.user.id, req.user.id);
    if (req.query.classes) {
      const ids = String(req.query.classes).split(',').map(intParam); if (ids.some(i => !i)) return res.status(400).json({ error: 'classes must be a list of class ids' });
      if (ids.some(i => !rows.some(r => r.id === i))) return res.status(403).json({ error: 'No access to one of those classes' });
      rows = rows.filter(r => ids.includes(r.id));
    }
    const subs = await all('SELECT id,slug,name FROM subjects ORDER BY id'), classes = []; for (const r of rows.slice(0, 10)) classes.push(await metrics(r, subs));
    if (req.query.format === 'csv') return sendCsv(res, 'class-comparison.csv', toCsv(['Class', 'Students', 'Avg points', 'Quiz accuracy %', 'Active last 7 days %', 'Missions approved %', 'Avg streak', ...subs.map(s => s.name + ' accuracy %')],
      classes.map(c => [c.name, c.students, c.avg_points, c.accuracy, c.active_rate, c.mission_rate, c.avg_streak, ...subs.map(s => c.subjects[s.slug])])));
    res.json({ subjects: subs.map(s => ({ slug: s.slug, name: s.name })), classes });
  }));

  app.get('/api/classes/:id/export.csv', T, view, wrap(async (req, res) => {
    const cid = +req.params.id, y = addDays(today(), -1), subs = await all('SELECT id,name FROM subjects ORDER BY id');
    const students = await all(`SELECT u.id,u.name,u.grade,
      (SELECT COUNT(*) FROM quiz_attempts t WHERE t.student_id=u.id) AS attempts, (SELECT COUNT(*) FROM quiz_attempts t WHERE t.student_id=u.id AND t.correct=1) AS correct,
      (SELECT COUNT(*) FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE s.student_id=u.id AND m.class_id=? AND s.status='approved') AS missions_done,
      CASE WHEN st.last_day >= ?::date THEN st.current ELSE 0 END AS streak, COALESCE(st.best,0) AS best,
      GREATEST((SELECT MAX(created_at) FROM activity WHERE student_id=u.id),(SELECT MAX(created_at) FROM quiz_attempts WHERE student_id=u.id)) AS last_active
      FROM enrollments e JOIN users u ON u.id=e.student_id LEFT JOIN streaks st ON st.student_id=u.id WHERE e.class_id=? ORDER BY u.name`, cid, y, cid);
    const pts = await all('SELECT a.student_id,a.subject_id,SUM(a.points) AS p FROM activity a JOIN enrollments e ON e.student_id=a.student_id AND e.class_id=? GROUP BY 1,2', cid);
    const of = (sid, sub) => pts.filter(r => r.student_id === sid && (sub == null || r.subject_id === sub)).reduce((a, r) => a + r.p, 0);
    sendCsv(res, `class-${cid}-students.csv`, toCsv(['Name', 'Grade', 'Total points', ...subs.map(s => s.name + ' points'), 'Current streak', 'Best streak', 'Quiz attempts', 'Quiz accuracy %', 'Missions approved', 'Last active'],
      students.map(s => [s.name, s.grade, of(s.id), ...subs.map(x => of(s.id, x.id)), s.streak, s.best, s.attempts, pct(s.correct, s.attempts), s.missions_done, dayOf(s.last_active)])));
  }));

  // ---------- student portfolio (the student's own, or a teacher viewing a student of their class) ----------
  async function portfolio(sid) {
    const u = await get('SELECT name,grade,photo,created_at FROM users WHERE id=?', sid);
    const subs = await all(`SELECT s.slug,s.name,s.color,s.icon,
      COALESCE((SELECT SUM(a.points) FROM activity a WHERE a.student_id=? AND a.subject_id=s.id),0) AS points,
      (SELECT COUNT(*) FROM quiz_attempts t JOIN quizzes q ON q.id=t.quiz_id WHERE t.student_id=? AND q.subject_id=s.id) AS attempts,
      (SELECT COUNT(*) FROM quiz_attempts t JOIN quizzes q ON q.id=t.quiz_id WHERE t.student_id=? AND q.subject_id=s.id AND t.correct=1) AS correct FROM subjects s ORDER BY s.id`, sid, sid, sid);
    const total = (await get('SELECT COALESCE(SUM(points),0) AS p FROM activity WHERE student_id=?', sid)).p;
    const attempts = subs.reduce((a, s) => a + s.attempts, 0), correct = subs.reduce((a, s) => a + s.correct, 0);
    return {
      student: { name: u.name, grade: u.grade, photo: u.photo, joined: u.created_at }, points: total, level: Math.floor(total / 100) + 1,
      badges: BADGES.filter(([at]) => total >= at).map(([at, name, icon]) => ({ at, name, icon })), streak: await streakOf(get, sid),
      subjects: subs.map(s => ({ ...s, accuracy: pct(s.correct, s.attempts) })), quiz: { attempts, correct, accuracy: pct(correct, attempts) },
      daily_challenges: (await get(`SELECT COUNT(*) AS n FROM activity WHERE student_id=? AND kind='daily'`, sid)).n,
      missions: await all(`SELECT m.title,s.awarded,s.reviewed_at,s.photo,${SUBJ} FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE s.student_id=? AND s.status='approved' ORDER BY s.reviewed_at DESC, s.id DESC LIMIT 50`, sid),
      projects: await all(`SELECT DISTINCT p.id,p.title FROM enrollments e JOIN project_classes pc ON pc.class_id=e.class_id AND pc.status='accepted' JOIN projects p ON p.id=pc.project_id WHERE e.student_id=? ORDER BY p.id`, sid) };
  }
  app.get('/api/student/portfolio', S, wrap(async (req, res) => res.json(await portfolio(req.user.id))));
  app.get('/api/classes/:id/students/:sid/portfolio', T, view, wrap(async (req, res) => {
    const sid = intParam(req.params.sid); if (!sid || !(await get('SELECT 1 FROM enrollments WHERE class_id=? AND student_id=?', +req.params.id, sid))) return res.status(404).json({ error: 'Student not in this class' });
    res.json(await portfolio(sid));
  }));
}
