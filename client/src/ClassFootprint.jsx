import { useEffect, useState } from 'react';
import { api } from './api';
import { Loading, Pick } from './ui';
import { BarChart } from './charts';

const fmt = g => { g = Number(g) || 0; return g < 1000 ? `${g} g` : `${(g / 1000).toFixed(1).replace(/\.0$/, '')} kg`; };

/** Teacher dashboard card: what the selected class has saved through the eco-footprint tracker (estimates). */
export default function ClassFootprint({ ctx }) {
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); if (ctx.classId) api(`/classes/${ctx.classId}/footprint`).then(setD).catch(() => setD(false)); }, [ctx.classId]);
  if (!ctx.classes.length) return null;
  return (
    <section className="card">
      <h2>Class eco footprint</h2>
      <p className="muted">What your students logged in the Footprint tracker. CO₂ numbers are rough estimates.</p>
      <div style={{ margin: '.75rem 0' }}><Pick ctx={ctx} /></div>
      {d === false && <p className="muted">Could not load this class right now.</p>}
      {d === null && ctx.classId && <Loading />}
      {d && (
        <>
          <div className="stats-3">
            <div className="stat"><span className="label">CO₂ saved by the class (about)</span><div className="big">{fmt(d.total_grams)}</div></div>
            <div className="stat"><span className="label">Saved in the last 7 days (about)</span><div className="big">{fmt(d.week_grams)}</div></div>
            <div className="stat"><span className="label">Students active this week</span><div className="big">{d.active_week}<span className="unit">of {d.students}</span></div></div>
          </div>
          {d.total_logs === 0 ? <p className="muted" style={{ marginTop: '1rem' }}>No actions logged yet. Students log them under Footprint.</p> : (
            <div className="grid-2" style={{ marginTop: '1.25rem', alignItems: 'start' }}>
              <div><h3>Top actions</h3>
                <BarChart label="CO2 saved by action" unit=" g" rows={d.top.map(t => ({ label: `${t.icon} ${t.label}`, value: t.grams, color: '#d6ff00' }))} /></div>
              <div><h3>Students who saved the most</h3>
                <BarChart label="CO2 saved by student" unit=" g" rows={d.by_student.map(s => ({ label: s.name, value: s.grams, color: '#4da3ff' }))} /></div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
