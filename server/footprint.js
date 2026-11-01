// Eco-footprint tracker: students log small everyday eco actions (once per action per day) and see an estimated CO2 saving.
// Mounted from index.js:  footprint({ app, S, T, view, wrap, all, get, run })
import { today, addDays } from './shared.js';

// grams of CO2 saved per action. These are rough everyday estimates for motivation, not measurements: the page says "about".
export const ACTIONS = [
  { id: 'cycle_walk', icon: '🚲', label: 'Walked or cycled instead of using a vehicle', grams: 1000 },
  { id: 'public_transport', icon: '🚌', label: 'Used a bus, metro or shared ride', grams: 800 },
  { id: 'veg_meal', icon: '🥗', label: 'Ate a plant-based meal', grams: 700 },
  { id: 'compost', icon: '🍂', label: 'Composted food or garden waste', grams: 250 },
  { id: 'lights_off', icon: '💡', label: 'Switched off lights and fans when leaving', grams: 200 },
  { id: 'short_shower', icon: '🚿', label: 'Took a short bath or shower', grams: 150 },
  { id: 'recycle', icon: '♻️', label: 'Sorted and recycled waste', grams: 150 },
  { id: 'refill_bottle', icon: '🚰', label: 'Refilled a bottle instead of buying one', grams: 80 },
  { id: 'plant', icon: '🌱', label: 'Planted or watered a plant', grams: 50 },
  { id: 'reusable_bag', icon: '🛍️', label: 'Used a reusable bag', grams: 30 },
];
const BY_ID = Object.fromEntries(ACTIONS.map(a => [a.id, a]));

export default function footprint({ app, S, T, view, wrap, all, get, run }) {
  app.get('/api/footprint', S, wrap(async (req, res) => {
    const id = req.user.id, t = today(), days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
    const recent = await all(`SELECT action, to_char(day,'YYYY-MM-DD') AS day FROM eco_logs WHERE student_id=? AND day >= ?::date`, id, days[0]);
    const counts = await all('SELECT action, COUNT(*) AS n FROM eco_logs WHERE student_id=? GROUP BY action', id);
    const grams = a => BY_ID[a]?.grams || 0;
    const series = days.map(d => recent.filter(r => r.day === d).reduce((s, r) => s + grams(r.action), 0));
    const by_action = counts.filter(c => BY_ID[c.action]).map(c => ({ id: c.action, count: Number(c.n), grams: Number(c.n) * grams(c.action) }));
    res.json({ actions: ACTIONS, today: recent.filter(r => r.day === t).map(r => r.action), days, series,
      total_grams: by_action.reduce((s, a) => s + a.grams, 0), total_logs: by_action.reduce((s, a) => s + a.count, 0), by_action });
  }));

  app.post('/api/footprint/log', S, wrap(async (req, res) => {
    const a = BY_ID[req.body?.action]; if (!a) return res.status(400).json({ error: 'Pick an action from the list' });
    const r = await run('INSERT INTO eco_logs(student_id,action,day) VALUES(?,?,?::date) ON CONFLICT DO NOTHING', req.user.id, a.id, today());
    r.rowCount ? res.json({ ok: true, grams: a.grams }) : res.status(409).json({ error: 'You already logged this today' });
  }));

  // teachers (owner or view-only colleague): the class's combined estimated saving
  app.get('/api/classes/:id/footprint', T, view, wrap(async (req, res) => {
    const cid = +req.params.id, weekStart = addDays(today(), -6);
    const students = await all('SELECT u.id,u.name FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.class_id=?', cid);
    const logs = await all(`SELECT l.student_id, l.action, to_char(l.day,'YYYY-MM-DD') AS day FROM eco_logs l JOIN enrollments e ON e.student_id=l.student_id WHERE e.class_id=?`, cid);
    const g = a => BY_ID[a]?.grams || 0, valid = logs.filter(l => BY_ID[l.action]);
    const per = new Map(students.map(s => [s.id, { name: s.name, grams: 0, logs: 0 }]));
    for (const l of valid) { const p = per.get(l.student_id); if (p) { p.grams += g(l.action); p.logs++; } }
    const acts = {}; for (const l of valid) acts[l.action] = (acts[l.action] || 0) + 1;
    const week = valid.filter(l => l.day >= weekStart);
    res.json({ students: students.length, total_logs: valid.length, total_grams: valid.reduce((s, l) => s + g(l.action), 0),
      week_grams: week.reduce((s, l) => s + g(l.action), 0), active_week: new Set(week.map(l => l.student_id)).size,
      top: Object.entries(acts).map(([id, n]) => ({ id, icon: BY_ID[id].icon, label: BY_ID[id].label, count: n, grams: n * g(id) })).sort((a, b) => b.grams - a.grams).slice(0, 5),
      by_student: [...per.values()].filter(p => p.logs).sort((a, b) => b.grams - a.grams).slice(0, 10) });
  }));

  // undo a tap made by mistake: only today's entry can be removed
  app.delete('/api/footprint/log/:action', S, wrap(async (req, res) => {
    const r = await run('DELETE FROM eco_logs WHERE student_id=? AND action=? AND day=?::date', req.user.id, String(req.params.action), today());
    r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Nothing to undo' });
  }));
}
