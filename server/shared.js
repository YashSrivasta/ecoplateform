import pg from 'pg';
pg.types.setTypeParser(1082, v => v); // DATE columns come back as 'YYYY-MM-DD' strings, not JS Dates

// "Today" is decided in one timezone for everyone, so streaks and daily challenges roll over at the same moment.
export const TZ = process.env.APP_TZ || 'Asia/Kolkata';
export const today = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ });
export const addDays = (s, n) => { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

// Grade bands used by daily challenges (same ranges as the starter questions)
export const BANDS = { 1: [1, 5], 2: [6, 8], 3: [9, 12], 4: [13, 20] };
export const band = g => (g <= 5 ? 1 : g <= 8 ? 2 : g <= 12 ? 3 : 4);

export const BADGES = [[10, 'Seedling', '🌱'], [50, 'Sprout', '🌿'], [100, 'Tree Hugger', '🌳'], [250, 'Eco Warrior', '🦸'], [500, 'Planet Guardian', '🌍']];
export const badgesBetween = (before, after) => BADGES.filter(([at]) => before < at && after >= at).map(([at, name, icon]) => ({ at, name, icon }));

// Call inside the same transaction that awards points or records an attempt.
// Any day with a quiz answer or an approved mission counts as "played". Yesterday keeps the streak alive.
export async function touchStreak(x, id) {
  const t = today();
  const r = (await x('SELECT current, best, last_day FROM streaks WHERE student_id=? FOR UPDATE', id)).rows[0];
  const cur = !r ? 1 : r.last_day === t ? r.current : r.last_day === addDays(t, -1) ? r.current + 1 : 1;
  const best = Math.max(cur, r?.best || 0);
  await x(`INSERT INTO streaks(student_id,current,best,last_day) VALUES(?,?,?,?::date)
    ON CONFLICT(student_id) DO UPDATE SET current=EXCLUDED.current, best=GREATEST(streaks.best,EXCLUDED.best), last_day=EXCLUDED.last_day`, id, cur, best, t);
  return { current: cur, best };
}

// What to show on screen: a streak that was not played yesterday or today has already ended.
export async function streakOf(get, id) {
  const r = await get('SELECT current, best, last_day FROM streaks WHERE student_id=?', id), t = today();
  if (!r) return { current: 0, best: 0, playedToday: false };
  const alive = r.last_day === t || r.last_day === addDays(t, -1);
  return { current: alive ? r.current : 0, best: r.best, playedToday: r.last_day === t };
}
