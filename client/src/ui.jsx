import { createContext, useContext, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { img } from './api';

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);
export const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

const PATHS = {
  leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  quiz: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  tasks: <><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  bars: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
};
export function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>;
}

export function Avatar({ u, lg }) {
  const cls = 'av' + (lg ? ' lg' : '');
  return u.photo ? <img className={cls} src={img(u.photo)} alt="" /> : <div className={cls} aria-hidden="true">{(u.name || '?')[0].toUpperCase()}</div>;
}

export const fmtDay = d => { const t = new Date(d + 'T00:00:00'); return isNaN(t) ? d : t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
export const fmtDate = d => { const t = new Date(d); return isNaN(t) ? '' : t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };

export function Proof({ src, name }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div className="proof empty">Photo no longer available</div>;
  return <a href={img(src)} target="_blank" rel="noreferrer"><img className="proof" src={img(src)} alt={`Photo submitted by ${name}`} onError={() => setBad(true)} /></a>;
}

export function PointsChart({ data, height = 220 }) {
  if (!data.length) return <p className="muted">Earn points to see your chart grow.</p>;
  const tick = { fill: '#8e95a4', fontSize: 12 };
  const ring = { fill: '#b9f20a', stroke: '#1b1f27', strokeWidth: 2 };
  return (
    <>
      <div role="img" aria-label="Points earned per day">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 12, right: 14, left: -16, bottom: 0 }}>
            <defs><linearGradient id="ptsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b9f20a" stopOpacity=".26" /><stop offset="100%" stopColor="#b9f20a" stopOpacity="0" /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#2b303c" strokeDasharray="3 6" />
            <XAxis dataKey="day" tickFormatter={fmtDay} tick={tick} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ stroke: '#4a5163' }} contentStyle={{ background: '#0e1015', border: '1px solid #303644', borderRadius: 12 }} labelStyle={{ color: '#8e95a4' }} itemStyle={{ color: '#f4f6f9' }} labelFormatter={fmtDay} formatter={v => [v + ' points', 'Earned']} />
            <Area type="monotone" dataKey="points" stroke="#b9f20a" strokeWidth={2} fill="url(#ptsFill)" dot={{ r: 4, ...ring }} activeDot={{ r: 6, ...ring }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="table-view"><summary>View as table</summary>
        <table><thead><tr><th>Day</th><th className="num">Points</th></tr></thead>
          <tbody>{data.map(r => <tr key={r.day}><td>{fmtDay(r.day)}</td><td className="num">{r.points}</td></tr>)}</tbody></table>
      </details>
    </>
  );
}

export function Pick({ ctx }) {
  const none = !ctx.classes.length;
  return (
    <div className="filters">
      <label className="label" htmlFor="class-pick">Class</label>
      <select id="class-pick" value={ctx.classId || ''} disabled={none} onChange={e => ctx.setClassId(+e.target.value)}>
        {none && <option value="">No classes yet. Create one on the Dashboard.</option>}
        {ctx.classes.map(c => <option key={c.id} value={c.id}>{c.name} · {c.code}{c.owner ? '' : ' (view only)'}</option>)}
      </select>
    </div>
  );
}
