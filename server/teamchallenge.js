// Team challenges: a teacher splits one of their classes into teams for a date range; a team's score is the points its members
// earn (from the activity table) during those dates. Teams are ranked by AVERAGE points per member so uneven teams stay fair.
// Mounted from index.js:  teamchallenge({ app, S, T, own, view, wrap, all, get, run, tx })
import { today, addDays, TZ } from './shared.js';

export const TEAMS = [
  ['Team Leaf', '#7bd88f'], ['Team River', '#4da3ff'], ['Team Sun', '#ffcf5c'],
  ['Team Fire', '#ff7a6b'], ['Team Sky', '#b79cff'], ['Team Ocean', '#5fd3d0'],
];
const MAX_DAYS = 60, MAX_TEAMS = TEAMS.length;
const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(new Date(v + 'T00:00:00Z')) && addDays(String(v), 0) === v ? String(v) : null);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

// shuffle, then deal students out one by one so team sizes differ by at most 1
export function splitTeams(ids, n, rnd = Math.random) {
  const a = [...ids]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const teams = Array.from({ length: n }, () => []); a.forEach((id, i) => teams[i % n].push(id)); return teams;
}
// rows: [{id,name,color,members,points}] -> ranked, with average and rank (equal averages share a rank)
export function rankTeams(rows) {
  const r = rows.map(t => ({ ...t, members: +t.members, points: +t.points, average: +t.members ? Math.round((10 * +t.points) / +t.members) / 10 : 0 }))
    .sort((a, b) => b.average - a.average || b.points - a.points || a.id - b.id);
  r.forEach((t, i) => { t.rank = i && t.average === r[i - 1].average ? r[i - 1].rank : i + 1; }); return r;
}
const status = (c, t) => (t < c.starts_on ? 'upcoming' : t > c.ends_on ? 'ended' : 'active');
// the winning team name(s) of a finished challenge; nobody wins when no team scored
export const winners = (teams, st) => (st === 'ended' && teams[0]?.rank === 1 && teams[0].average > 0 ? teams.filter(x => x.rank === 1).map(x => x.name) : null);

export default function teamchallenge({ app, S, T, own, view, wrap, all, get, run, tx }) {
  const standings = async c => rankTeams(await all(`SELECT t.id,t.name,t.color,COUNT(m.student_id) AS members,COALESCE(SUM(p.pts),0) AS points
    FROM challenge_teams t LEFT JOIN challenge_members m ON m.team_id=t.id
    LEFT JOIN (SELECT student_id, SUM(points) AS pts FROM activity WHERE (created_at AT TIME ZONE ?::text)::date BETWEEN ?::date AND ?::date GROUP BY student_id) p ON p.student_id=m.student_id
    WHERE t.challenge_id=? GROUP BY t.id`, TZ, c.starts_on, c.ends_on, c.id));
  // Students who joined the class after a challenge started are not on a team yet: put each one in the currently smallest team.
  // One at a time, so several newcomers spread out instead of all landing in the same team. Challenges that already ended are left alone.
  async function placeNewcomers(cid, t) {
    const late = await all(`SELECT c.id AS challenge_id, e.student_id FROM team_challenges c JOIN enrollments e ON e.class_id=c.class_id
      WHERE c.class_id=? AND c.ends_on >= ?::date AND NOT EXISTS (SELECT 1 FROM challenge_members m WHERE m.challenge_id=c.id AND m.student_id=e.student_id)
      ORDER BY c.id, e.student_id LIMIT 200`, cid, t);
    for (const r of late) await run(`INSERT INTO challenge_members(challenge_id,team_id,student_id)
      SELECT ?::int, t.id, ?::int FROM challenge_teams t LEFT JOIN challenge_members m ON m.team_id=t.id WHERE t.challenge_id=?::int
      GROUP BY t.id ORDER BY COUNT(m.student_id), t.id LIMIT 1 ON CONFLICT DO NOTHING`, r.challenge_id, r.student_id, r.challenge_id);
  }
  const CH = `id,class_id,title,to_char(starts_on,'YYYY-MM-DD') AS starts_on,to_char(ends_on,'YYYY-MM-DD') AS ends_on`;

  // teacher: all challenges of a class, with standings and who is on which team
  app.get('/api/classes/:id/challenges', T, view, wrap(async (req, res) => {
    const t = today(), out = [];
    await placeNewcomers(+req.params.id, t);
    for (const c of await all(`SELECT ${CH} FROM team_challenges WHERE class_id=? ORDER BY id DESC LIMIT 20`, +req.params.id)) {
      const names = await all('SELECT m.team_id,u.name FROM challenge_members m JOIN users u ON u.id=m.student_id WHERE m.challenge_id=? ORDER BY u.name', c.id);
      const teams = await standings(c), st = status(c, t);
      out.push({ ...c, status: st, winner: winners(teams, st), teams: teams.map(x => ({ ...x, names: names.filter(n => n.team_id === x.id).map(n => n.name) })) });
    }
    res.json(out);
  }));

  // teacher (class creator): start a challenge. Students are split into balanced random teams.
  app.post('/api/classes/:id/challenges', T, own, wrap(async (req, res) => {
    const b = req.body || {}, cid = +req.params.id, t = today();
    const title = String(b.title || '').trim(), starts = day(b.starts_on), ends = day(b.ends_on), n = /^\d$/.test(String(b.teams)) ? +b.teams : 0;
    if (title.length < 3 || title.length > 80) return res.status(400).json({ error: 'Write a title of 3 to 80 characters' });
    if (!starts || !ends) return res.status(400).json({ error: 'Choose a start date and an end date' });
    if (starts < t) return res.status(400).json({ error: 'The start date cannot be in the past' });
    if (ends < starts) return res.status(400).json({ error: 'The end date must be on or after the start date' });
    if (daysBetween(starts, ends) + 1 > MAX_DAYS) return res.status(400).json({ error: `A challenge can last up to ${MAX_DAYS} days` });
    if (n < 2 || n > MAX_TEAMS) return res.status(400).json({ error: `Choose 2 to ${MAX_TEAMS} teams` });
    const students = (await all('SELECT student_id FROM enrollments WHERE class_id=?', cid)).map(s => s.student_id);
    if (students.length < n * 2) return res.status(400).json({ error: `You need at least ${n * 2} students in the class for ${n} teams (2 per team). This class has ${students.length}.` });
    let id;
    await tx(async x => {
      id = (await x('INSERT INTO team_challenges(class_id,teacher_id,title,starts_on,ends_on) VALUES(?,?,?,?::date,?::date) RETURNING id', cid, req.user.id, title, starts, ends)).rows[0].id;
      const groups = splitTeams(students, n);
      for (let i = 0; i < n; i++) {
        const tid = (await x('INSERT INTO challenge_teams(challenge_id,name,color) VALUES(?,?,?) RETURNING id', id, TEAMS[i][0], TEAMS[i][1])).rows[0].id;
        for (const sid of groups[i]) await x('INSERT INTO challenge_members(challenge_id,team_id,student_id) VALUES(?,?,?)', id, tid, sid);
      }
    });
    res.json({ ok: true, id });
  }));

  app.delete('/api/classes/:id/challenges/:cid', T, own, wrap(async (req, res) => {
    const r = await run('DELETE FROM team_challenges WHERE id=? AND class_id=?', /^\d{1,9}$/.test(req.params.cid) ? +req.params.cid : 0, +req.params.id);
    r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Challenge not found' });
  }));

  // student: challenges they are in (running, coming up, or ended in the last 14 days), with the scoreboard and their own team mates
  app.get('/api/student/challenges', S, wrap(async (req, res) => {
    const t = today(), out = [];
    for (const e of await all('SELECT class_id FROM enrollments WHERE student_id=?', req.user.id)) await placeNewcomers(e.class_id, t);
    for (const c of await all(`SELECT c.id,c.class_id,c.title,to_char(c.starts_on,'YYYY-MM-DD') AS starts_on,to_char(c.ends_on,'YYYY-MM-DD') AS ends_on,cl.name AS class_name,m.team_id
        FROM challenge_members m JOIN team_challenges c ON c.id=m.challenge_id JOIN classes cl ON cl.id=c.class_id
        WHERE m.student_id=? AND c.ends_on >= ?::date ORDER BY c.id DESC LIMIT 5`, req.user.id, addDays(t, -14))) {
      const teams = await standings(c), mine = teams.find(x => x.id === c.team_id);
      const mates = await all('SELECT u.name FROM challenge_members m JOIN users u ON u.id=m.student_id WHERE m.team_id=? AND m.student_id<>? ORDER BY u.name', c.team_id, req.user.id);
      out.push({ id: c.id, title: c.title, class_name: c.class_name, starts_on: c.starts_on, ends_on: c.ends_on, status: status(c, t),
        my_team_id: c.team_id, mates: mates.map(m => m.name), teams, winner: winners(teams, status(c, t)), my_rank: mine?.rank ?? null });
    }
    res.json(out);
  }));
}
