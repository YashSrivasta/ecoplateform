import { useEffect, useState } from 'react';
import { api } from './api';
import { Loading } from './ui';
import { BarChart, LineChart } from './charts';

/** Impact tracker: points per subject over the last 14 days, and each subject's share of the total. */
export default function Impact() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/student/impact').then(setD).catch(() => setD(false)); }, []);
  if (d === false) return null; // optional card: hide quietly if it cannot load
  if (!d) return <section className="card"><h2>Your impact</h2><Loading /></section>;
  const subs = d.subjects || [];
  const total = subs.reduce((a, s) => a + s.points, 0);
  const active = subs.filter(s => s.points > 0);
  return (
    <section className="card">
      <div className="between row" style={{ margin: 0 }}>
        <div><h2>Your impact</h2><p className="muted">Points you earned in each subject over the last 14 days</p></div>
        <div className="stat"><span className="label">All-time total</span><div className="big">{d.total ?? total}<span className="unit">pts</span></div></div>
      </div>
      {!total && !d.total ? <p className="muted" style={{ marginTop: 14 }}>Answer a quiz or finish a mission and your impact shows up here.</p> : (
        <div className="grid-2" style={{ marginTop: 18, alignItems: 'start' }}>
          <div>
            <h3>Growth by subject</h3>
            <LineChart labels={d.days} series={active.map(s => ({ name: s.name, color: s.color, values: d.series[s.slug] || [] }))} label="Total points in each subject over 14 days" />
          </div>
          <div>
            <h3>Where your points come from</h3>
            <BarChart label="Share of points by subject" unit="%" max={100} rows={subs.map(s => ({ label: `${s.icon} ${s.name}`, value: total ? Math.round((s.points / total) * 100) : 0, color: s.color }))} />
            <details className="table-view"><summary>View as table</summary>
              <div className="scroll"><table><thead><tr><th>Subject</th><th className="num">Points</th></tr></thead><tbody>{subs.map(s => <tr key={s.slug}><td>{s.name}</td><td className="num">{s.points}</td></tr>)}</tbody></table></div>
            </details>
          </div>
        </div>
      )}
    </section>
  );
}
