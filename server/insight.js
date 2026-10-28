// Stage 3: missions with subjects + deadlines, impact tracker, leaderboard, teacher analytics, rule-based suggestions.
// Mounted from index.js:  insight({ app, S, T, own, view, wrap, all, get, run, tx })
import { today, addDays, TZ, BADGES, touchStreak, streakOf } from './shared.js';

const MS_DAY = 864e5, pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
const lastDays = n => Array.from({ length: n }, (_, i) => addDays(today(), i - n + 1));

// Called inside the review transaction. Points are split evenly across the mission's subjects
// (the remainder goes to the first subjects), and an approved mission counts as a "played" day.
export async function awardMission(x, s, pts) {
  const subs = (await x('SELECT ms.subject_id, sb.name FROM mission_subjects ms JOIN subjects sb ON sb.id=ms.subject_id WHERE ms.mission_id=? ORDER BY ms.subject_id', s.mission_id)).rows;
  const parts = subs.length ? subs : [{ subject_id: null, name: '' }], base = Math.floor(pts / parts.length), extra = pts % parts.length;
  for (const [i, p] of parts.entries()) {
    const share = base + (i < extra ? 1 : 0);
    if (share > 0) await x('INSERT INTO activity(student_id,kind,text,points,subject_id) VALUES(?,?,?,?,?)', s.student_id, 'mission',
      'Mission approved: ' + s.title + (parts.length > 1 ? ` (${p.name})` : ''), share, p.subject_id);
  }
  return touchStreak(x, s.student_id);
}

// Shared by normal missions (below) and project missions (collab.js): one set of rules for title, subjects and deadline.
export async function parseMission(body, all, get) {
  const { title, description, points, subjects: subj, deadline } = body || {};
  if (typeof title !== 'string' || !title.trim() || !(points > 0)) return { error: 'Title and points required' };
  const known = await all('SELECT id,slug FROM subjects'), slugs = [...new Set(Array.isArray(subj) && subj.length ? subj : ['environment'])];
  const ids = slugs.map(s => known.find(k => k.slug === s)?.id); if (ids.some(i => !i)) return { error: 'Unknown subject' };
  let dl = null;
  if (deadline) { // 'YYYY-MM-DD' means the end of that day in the app timezone
    if (typeof deadline !== 'string') return { error: 'Invalid deadline' };
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(deadline);
    try { dl = (await get(dateOnly ? `SELECT ((?::date + 1)::timestamp AT TIME ZONE ?::text) - interval '1 second' AS d` : 'SELECT ?::timestamptz AS d', ...(dateOnly ? [deadline, TZ] : [deadline]))).d; }
    catch (e) { if (String(e.code).startsWith('22')) return { error: 'Invalid deadline' }; throw e; }
    if (new Date(dl) < new Date()) return { error: 'Deadline is in the past' };
  }
  return { title: title.trim().slice(0, 200), description: String(description || '').slice(0, 2000), points: Math.min(+points, 100), ids, dl };
}
export async function insertMission(x, classId, m, projectId = null) {
  const id = (await x('INSERT INTO missions(class_id,title,description,points,deadline,project_id) VALUES(?,?,?,?,?,?) RETURNING id', classId, m.title, m.description, m.points, m.dl, projectId)).rows[0].id;
  for (const sid of m.ids) await x('INSERT INTO mission_subjects(mission_id,subject_id) VALUES(?,?)', id, sid);
  return id;
}

export default function insight({ app, S, T, own, view, wrap, all, get, run, tx }) {
  const SUBJ_JSON = `(SELECT COALESCE(json_agg(json_build_object('slug',s.slug,'name',s.name,'color',s.color,'icon',s.icon) ORDER BY s.id),'[]'::json)
    FROM mission_subjects ms JOIN subjects s ON s.id=ms.subject_id WHERE ms.mission_id=m.id) AS subjects`;
  const day = col => `(${col} AT TIME ZONE ?::text)::date`; // always followed by a TZ parameter

  // ---------- missions: create (teacher) and list (student) ----------
  app.post('/api/classes/:id/missions', T, own, wrap(async (req, res) => {
    const m = await parseMission(req.body, all, get); if (m.error) return res.status(400).json({ error: m.error });
    let id; await tx(async x => { id = await insertMission(x, +req.params.id, m); });
    res.json({ ok: true, id });
  }));

  app.get('/api/missions', S, wrap(async (req, res) => res.json(await all(`SELECT m.id,m.title,m.description,m.points,m.deadline,(m.deadline IS NOT NULL AND m.deadline < NOW()) AS closed,c.name AS class_name,m.project_id,(SELECT p.title FROM projects p WHERE p.id=m.project_id) AS project,${SUBJ_JSON},
    (SELECT status FROM submissions s WHERE s.mission_id=m.id AND s.student_id=? ORDER BY s.id DESC LIMIT 1) AS status,
    (SELECT awarded FROM submissions s WHERE s.mission_id=m.id AND s.student_id=? ORDER BY s.id DESC LIMIT 1) AS awarded
    FROM missions m JOIN classes c ON c.id=m.class_id JOIN enrollments e ON e.class_id=c.id AND e.student_id=? ORDER BY m.id DESC`, req.user.id, req.user.id, req.user.id))));

  // ---------- impact tracker: cumulative points per subject ----------
  app.get('/api/student/impact', S, wrap(async (req, res) => {
    const subs = await all('SELECT id,slug,name,color,icon FROM subjects ORDER BY id'), days = lastDays(14);
    const rows = await all(`SELECT ${day('created_at')} AS day, subject_id, SUM(points) AS points FROM activity WHERE student_id=? AND points>0 AND subject_id IS NOT NULL GROUP BY 1,2`, TZ, req.user.id);
    const series = {}, totals = {};
    for (const s of subs) {
      const mine = rows.filter(r => r.subject_id === s.id); let cum = mine.filter(r => r.day < days[0]).reduce((a, r) => a + r.points, 0);
      series[s.slug] = days.map(d => (cum += mine.filter(r => r.day === d).reduce((a, r) => a + r.points, 0)));
      totals[s.slug] = mine.reduce((a, r) => a + r.points, 0);
    }
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    res.json({ total, days, series, subjects: subs.map(s => ({ slug: s.slug, name: s.name, color: s.color, icon: s.icon, points: totals[s.slug], share: pct(totals[s.slug], total) || 0 })) });
  }));

  // ---------- leaderboard ----------
  async function board(scopeSql, scopeParams, subjId, sort) {
    const rows = await all(`SELECT u.id,u.name,u.photo,
      COALESCE((SELECT SUM(a.points) FROM activity a WHERE a.student_id=u.id AND (?::int IS NULL OR a.subject_id=?::int)),0) AS points,
      (SELECT COUNT(*) FROM quiz_attempts t JOIN quizzes q ON q.id=t.quiz_id WHERE t.student_id=u.id AND (?::int IS NULL OR q.subject_id=?::int)) AS attempts,
      (SELECT COUNT(*) FROM quiz_attempts t JOIN quizzes q ON q.id=t.quiz_id WHERE t.student_id=u.id AND t.correct=1 AND (?::int IS NULL OR q.subject_id=?::int)) AS correct,
      CASE WHEN st.last_day >= ?::date THEN st.current ELSE 0 END AS streak
      FROM users u LEFT JOIN streaks st ON st.student_id=u.id WHERE u.role='student' AND u.id IN (${scopeSql})`,
      subjId, subjId, subjId, subjId, subjId, subjId, addDays(today(), -1), ...scopeParams);
    for (const r of rows) r.accuracy = pct(r.correct, r.attempts);
    const key = { points: r => r.points, streak: r => r.streak, accuracy: r => r.accuracy ?? -1 }[sort];
    rows.sort((a, b) => key(b) - key(a) || (sort === 'accuracy' ? b.attempts - a.attempts : 0) || b.points - a.points || a.name.localeCompare(b.name));
    rows.forEach((r, i) => { r.rank = i && key(r) === key(rows[i - 1]) ? rows[i - 1].rank : i + 1; });
    return rows;
  }
  async function boardQuery(req, res, scopeSql, scopeParams, mapRow) {
    const sort = req.query.sort || 'points'; if (!['points', 'streak', 'accuracy'].includes(sort)) return res.status(400).json({ error: 'sort must be points, streak or accuracy' });
    let subj = null; if (req.query.subject) { subj = await get('SELECT id,slug FROM subjects WHERE slug=?', req.query.subject); if (!subj) return res.status(400).json({ error: 'Unknown subject' }); }
    const limit = Math.min(Math.max(+req.query.limit || 50, 1), 100), rows = await board(scopeSql, scopeParams, subj?.id ?? null, sort);
    res.json({ sort, subject: subj?.slug || null, total: rows.length, rows: rows.slice(0, limit).map(mapRow) });
  }
  const shown = r => ({ rank: r.rank, name: r.name, photo: r.photo, points: r.points, streak: r.streak, accuracy: r.accuracy, attempts: r.attempts });
  // Students only ever see people who share a class with them.
  app.get('/api/leaderboard', S, wrap((req, res) => boardQuery(req, res,
    'SELECT e2.student_id FROM enrollments e1 JOIN enrollments e2 ON e2.class_id=e1.class_id WHERE e1.student_id=?', [req.user.id], r => ({ ...shown(r), me: r.id === req.user.id }))));
  app.get('/api/classes/:id/leaderboard', T, view, wrap((req, res) => boardQuery(req, res, 'SELECT student_id FROM enrollments WHERE class_id=?', [+req.params.id], r => ({ ...shown(r), id: r.id }))));

  // ---------- teacher analytics ----------
  app.get('/api/classes/:id/analytics', T, view, wrap(async (req, res) => {
    const cid = +req.params.id, days = lastDays(14), n = (await get('SELECT COUNT(*) AS n FROM enrollments WHERE class_id=?', cid)).n;
    const pts = (await get('SELECT COALESCE(SUM(a.points),0) AS p FROM activity a JOIN enrollments e ON e.student_id=a.student_id AND e.class_id=?', cid)).p;
    const acc = await get(`SELECT COUNT(*) AS attempts, COUNT(*) FILTER (WHERE t.correct=1) AS correct FROM quiz_attempts t JOIN enrollments e ON e.student_id=t.student_id AND e.class_id=?`, cid);
    const act = await all(`WITH d AS (
        SELECT a.student_id, ${day('a.created_at')} AS day, a.points FROM activity a JOIN enrollments e ON e.student_id=a.student_id AND e.class_id=?
        UNION ALL SELECT t.student_id, ${day('t.created_at')}, 0 FROM quiz_attempts t JOIN enrollments e ON e.student_id=t.student_id AND e.class_id=?)
      SELECT day, COUNT(DISTINCT student_id) AS active, SUM(points) AS points FROM d WHERE day >= ?::date GROUP BY day`, TZ, cid, TZ, cid, days[0]);
    const subjects = await all(`SELECT s.slug,s.name,s.color,s.icon,
        (SELECT COUNT(*) FROM quiz_attempts t JOIN quizzes q ON q.id=t.quiz_id JOIN enrollments e ON e.student_id=t.student_id AND e.class_id=? WHERE q.subject_id=s.id) AS attempts,
        (SELECT COUNT(*) FROM quiz_attempts t JOIN quizzes q ON q.id=t.quiz_id JOIN enrollments e ON e.student_id=t.student_id AND e.class_id=? WHERE q.subject_id=s.id AND t.correct=1) AS correct,
        COALESCE((SELECT SUM(a.points) FROM activity a JOIN enrollments e ON e.student_id=a.student_id AND e.class_id=? WHERE a.subject_id=s.id),0) AS points
      FROM subjects s ORDER BY s.id`, cid, cid, cid);
    const bd = await board('SELECT student_id FROM enrollments WHERE class_id=?', [cid], null, 'streak');
    const missions = await all(`WITH latest AS (SELECT DISTINCT ON (mission_id,student_id) mission_id,student_id,status FROM submissions ORDER BY mission_id,student_id,id DESC)
      SELECT m.id,m.title,m.points,m.deadline,(m.deadline IS NOT NULL AND m.deadline < NOW()) AS closed,${SUBJ_JSON},
        COUNT(l.status) FILTER (WHERE l.status='approved') AS approved, COUNT(l.status) FILTER (WHERE l.status='pending') AS pending, COUNT(l.status) FILTER (WHERE l.status='rejected') AS rejected
      FROM missions m LEFT JOIN latest l ON l.mission_id=m.id WHERE m.class_id=? GROUP BY m.id ORDER BY m.id DESC`, cid);
    res.json({
      performance: { students: n, total_points: pts, avg_points: n ? Math.round(pts / n) : 0, quiz_attempts: acc.attempts, accuracy: pct(acc.correct, acc.attempts) },
      activity: days.map(d => { const r = act.find(a => a.day === d); return { day: d, active_students: r?.active || 0, points: r?.points || 0 }; }),
      subjects: subjects.map(s => ({ ...s, accuracy: pct(s.correct, s.attempts) })),
      streaks: [['none', 0, 0], ['1-2 days', 1, 2], ['3-6 days', 3, 6], ['7+ days', 7, 1e9]].map(([label, lo, hi]) => ({ label, students: bd.filter(r => r.streak >= lo && r.streak <= hi).length })),
      missions: missions.map(m => ({ ...m, not_submitted: Math.max(0, n - m.approved - m.pending - m.rejected) })) });
  }));

  // ---------- suggestions (rule-based, from each person's own history) ----------
  const top = list => list.sort((a, b) => a.priority - b.priority).slice(0, 5).map(({ priority, ...x }) => x);

  app.get('/api/student/suggestions', S, wrap(async (req, res) => {
    const id = req.user.id, t = today(), out = [], me = await get('SELECT grade FROM users WHERE id=?', id);
    if (!(await get('SELECT 1 FROM enrollments WHERE student_id=?', id))) return res.json([{ kind: 'join', title: 'Join your class', text: 'Ask your teacher for the class code to unlock quizzes, missions and the leaderboard.', action: { type: 'join' } }]);
    const st = await streakOf(get, id), pts = (await get('SELECT COALESCE(SUM(points),0) AS p FROM activity WHERE student_id=?', id)).p;
    const subs = await all(`SELECT s.slug,s.name,COUNT(t.quiz_id) AS attempts,COUNT(t.quiz_id) FILTER (WHERE t.correct=1) AS correct,
      COALESCE((SELECT SUM(a.points) FROM activity a WHERE a.student_id=? AND a.subject_id=s.id),0) AS points
      FROM subjects s LEFT JOIN (SELECT t.quiz_id,t.correct,q.subject_id FROM quiz_attempts t JOIN quizzes q ON q.id=t.quiz_id WHERE t.student_id=?) t ON t.subject_id=s.id GROUP BY s.id ORDER BY s.id`, id, id);
    const available = (await get('SELECT COUNT(DISTINCT subject_id) AS n FROM quizzes WHERE ? BETWEEN grade_min AND grade_max', me.grade)).n;
    const doneDaily = (await get(`SELECT COUNT(DISTINCT subject_id) AS n FROM activity WHERE student_id=? AND kind='daily' AND ${day('created_at')}=?::date`, id, TZ, t)).n;
    const missions = await all(`SELECT m.id,m.title,m.points,m.deadline,(m.deadline IS NOT NULL AND m.deadline < NOW()) AS closed,
      (SELECT status FROM submissions s WHERE s.mission_id=m.id AND s.student_id=? ORDER BY s.id DESC LIMIT 1) AS status
      FROM missions m JOIN enrollments e ON e.class_id=m.class_id AND e.student_id=? ORDER BY m.id DESC`, id, id);

    if (st.current > 0 && !st.playedToday) out.push({ priority: 1, kind: 'streak', title: `Keep your ${st.current}-day streak`, text: 'Answer any quiz or a daily challenge today so the streak does not reset.', action: { type: 'daily' } });
    if (st.current === 0 && st.best === 0) out.push({ priority: 2, kind: 'streak', title: 'Start your streak', text: 'Answer a quiz today, then come back tomorrow to build a streak.', action: { type: 'quiz' } });
    for (const m of missions.filter(m => !m.closed && !['pending', 'approved'].includes(m.status))) {
      const left = m.deadline ? new Date(m.deadline) - Date.now() : null;
      if (m.status === 'rejected') out.push({ priority: 2, kind: 'mission', title: `Resubmit “${m.title}”`, text: 'Your last photo was not accepted. Try again with a clearer photo.', action: { type: 'mission', id: m.id } });
      else if (left !== null && left < 3 * MS_DAY) out.push({ priority: 1, kind: 'mission', title: `“${m.title}” is due soon`, text: `Closes in ${Math.max(1, Math.ceil(left / 36e5))} hours. Worth up to ${m.points} points.`, action: { type: 'mission', id: m.id } });
      else out.push({ priority: 4, kind: 'mission', title: `Open mission: ${m.title}`, text: `Worth up to ${m.points} points.`, action: { type: 'mission', id: m.id } });
    }
    if (doneDaily < available) out.push({ priority: 3, kind: 'daily', title: `${available - doneDaily} daily challenge${available - doneDaily > 1 ? 's' : ''} left`, text: 'Daily challenges are worth double points.', action: { type: 'daily' } });
    const weak = subs.filter(s => s.attempts >= 3 && s.correct / s.attempts < 0.7).sort((a, b) => a.correct / a.attempts - b.correct / b.attempts)[0];
    if (weak) out.push({ priority: 3, kind: 'practice', title: `Practise ${weak.name}`, text: `Your accuracy is ${pct(weak.correct, weak.attempts)}%. A few more questions will lift it.`, action: { type: 'quiz', subject: weak.slug } });
    const fresh = subs.find(s => s.points === 0); if (fresh) out.push({ priority: 4, kind: 'explore', title: `Try ${fresh.name}`, text: 'You have not earned any points here yet.', action: { type: 'quiz', subject: fresh.slug } });
    const next = BADGES.find(([at]) => at > pts); if (next && next[0] - pts <= 30) out.push({ priority: 5, kind: 'badge', title: `${next[0] - pts} points to ${next[1]}`, text: `${next[2]} is almost yours.`, action: { type: 'quiz' } });
    res.json(top(out.length ? out : [{ priority: 9, kind: 'explore', title: 'You are all caught up', text: 'Try another subject quiz to keep learning.', action: { type: 'quiz' } }]));
  }));

  app.get('/api/classes/:id/suggestions', T, view, wrap(async (req, res) => {
    const cid = +req.params.id, out = [], cls = await get('SELECT name,code FROM classes WHERE id=?', cid);
    const students = await all(`SELECT u.name, GREATEST((SELECT MAX(created_at) FROM activity WHERE student_id=u.id),(SELECT MAX(created_at) FROM quiz_attempts WHERE student_id=u.id)) AS last_active
      FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.class_id=? ORDER BY u.name`, cid);
    if (!students.length) return res.json([{ kind: 'invite', title: 'Invite your students', text: `Share the class code ${cls.code} so students can join ${cls.name}.`, action: { type: 'share' } }]);
    const pending = (await get(`SELECT COUNT(*) AS n FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE m.class_id=? AND s.status='pending'`, cid)).n;
    const doubts = (await get('SELECT COUNT(*) AS n FROM doubts WHERE class_id=? AND reply IS NULL', cid)).n;
    const recentMissions = (await get(`SELECT COUNT(*) AS n FROM missions WHERE class_id=? AND created_at > NOW() - interval '14 days'`, cid)).n;
    const quiet = students.filter(s => !s.last_active || Date.now() - new Date(s.last_active) > 7 * MS_DAY);
    const subs = await all(`SELECT s.name,COUNT(t.quiz_id) AS attempts,COUNT(t.quiz_id) FILTER (WHERE t.correct=1) AS correct
      FROM subjects s LEFT JOIN (SELECT t.quiz_id,t.correct,q.subject_id FROM quiz_attempts t JOIN quizzes q ON q.id=t.quiz_id JOIN enrollments e ON e.student_id=t.student_id AND e.class_id=?) t ON t.subject_id=s.id GROUP BY s.id ORDER BY s.id`, cid);
    const bd = await board('SELECT student_id FROM enrollments WHERE class_id=?', [cid], null, 'streak'), hot = bd.filter(r => r.streak >= 7);

    if (pending) out.push({ priority: 1, kind: 'review', title: `${pending} photo${pending > 1 ? 's' : ''} waiting for review`, text: 'Students see their points only after you approve.', action: { type: 'review' } });
    if (doubts) out.push({ priority: 2, kind: 'doubts', title: `${doubts} unanswered question${doubts > 1 ? 's' : ''}`, text: 'Students asked in “Ask your teacher”.', action: { type: 'doubts' } });
    if (quiet.length) out.push({ priority: 2, kind: 'inactive', title: `${quiet.length} student${quiet.length > 1 ? 's' : ''} inactive for 7+ days`, text: quiet.slice(0, 5).map(s => s.name).join(', ') + (quiet.length > 5 ? ` and ${quiet.length - 5} more` : ''), action: { type: 'students' } });
    for (const s of subs.filter(s => s.attempts >= 5 && s.correct / s.attempts < 0.6)) out.push({ priority: 2, kind: 'weak', title: `Class is struggling with ${s.name}`, text: `Accuracy is ${pct(s.correct, s.attempts)}%. Consider a revision session or a related mission.`, action: { type: 'mission' } });
    if (!recentMissions) out.push({ priority: 3, kind: 'mission', title: 'Post a new mission', text: 'No mission has been posted in the last 14 days.', action: { type: 'mission' } });
    for (const s of subs.filter(s => s.attempts === 0).slice(0, 2)) out.push({ priority: 4, kind: 'unused', title: `Nobody has tried ${s.name}`, text: 'Mention it in class or set a mission in this subject.', action: { type: 'mission' } });
    if (hot.length) out.push({ priority: 4, kind: 'praise', title: `${hot.length} student${hot.length > 1 ? 's' : ''} on a 7+ day streak`, text: hot.slice(0, 5).map(s => s.name).join(', ') + '. A word of praise goes a long way.', action: { type: 'leaderboard' } });
    res.json(top(out.length ? out : [{ priority: 9, kind: 'ok', title: 'Everything looks on track', text: 'No action needed right now.', action: { type: 'none' } }]));
  }));
}
