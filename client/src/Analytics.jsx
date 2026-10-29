import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { Icon, Loading, Pick, fmtDate } from './ui';
import { AreaChart, BarChart } from './charts';
import './analytics.css';

const n = v => Number(v) || 0;
const STREAK_LABEL = { none: 'No streak' };

export default function Analytics() {
  const ctx = useOutletContext();
  const [d, setD] = useState(null);
  const [sug, setSug] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!ctx.classId) return;
    setD(null); setErr(''); setSug([]);
    api(`/classes/${ctx.classId}/analytics`).then(setD).catch(e => setErr(e.message));
    api(`/classes/${ctx.classId}/suggestions`).then(setSug).catch(() => {});
  }, [ctx.classId]);

  const p = d?.performance;
  return (
    <>
      <header className="page-head"><div><h1>Analytics</h1><p className="muted">How your class is doing, in the last 14 days and overall.</p></div></header>
      <Pick ctx={ctx} />
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {ctx.classId && !d && !err && <Loading />}
      {d && !n(p.students) && <section className="card"><p className="muted">No students have joined this class yet. Share the class code from the Dashboard.</p></section>}
      {d && n(p.students) > 0 && (
        <>
          <div className="an-tiles">
            <div className="tile"><span className="label">Students</span><div className="big">{n(p.students)}</div></div>
            <div className="tile"><span className="label">Total points</span><div className="big">{n(p.total_points)}</div></div>
            <div className="tile"><span className="label">Average per student</span><div className="big">{n(p.avg_points)}</div></div>
            <div className="tile"><span className="label">Questions answered</span><div className="big">{n(p.quiz_attempts)}</div></div>
            <div className="tile"><span className="label">Quiz accuracy</span><div className="big">{p.accuracy == null ? '–' : n(p.accuracy)}{p.accuracy != null && <span className="unit">%</span>}</div></div>
          </div>

          {sug.length > 0 && (
            <section className="card">
              <h2>Suggestions for you</h2><p className="muted">Picked from what your students have done</p>
              <div style={{ marginTop: 6 }}>{sug.map((s, i) => <div className="an-sug" key={i}><span className="ico"><Icon name="star" size={16} /></span><div><b>{s.title}</b><span className="muted">{s.text}</span></div></div>)}</div>
            </section>
          )}

          <div className="grid-2">
            <section className="card"><h2>Points earned</h2><p className="muted">By your whole class, per day</p><div style={{ marginTop: 14 }}><AreaChart data={d.activity.map(a => ({ day: a.day, points: n(a.points) }))} label="Points earned by the class per day" /></div></section>
            <section className="card"><h2>Active students</h2><p className="muted">Students who played or earned points, per day</p><div style={{ marginTop: 14 }}><AreaChart data={d.activity.map(a => ({ day: a.day, students: n(a.active_students) }))} yKey="students" unit="students" label="Active students per day" /></div></section>
          </div>

          <div className="grid-2">
            <section className="card">
              <h2>Accuracy by subject</h2><p className="muted">Share of quiz answers that were correct</p>
              <BarChart label="Quiz accuracy by subject" unit="%" max={100} rows={d.subjects.map(s => ({ label: `${s.icon} ${s.name}`, value: s.accuracy == null ? 0 : n(s.accuracy), color: s.color }))} />
              <details className="table-view"><summary>View as table</summary>
                <div className="scroll"><table><thead><tr><th>Subject</th><th className="num">Answered</th><th className="num">Points</th><th className="num">Accuracy</th></tr></thead>
                  <tbody>{d.subjects.map(s => <tr key={s.slug}><td>{s.name}</td><td className="num">{n(s.attempts)}</td><td className="num">{n(s.points)}</td><td className="num">{s.accuracy == null ? 'No answers yet' : n(s.accuracy) + '%'}</td></tr>)}</tbody></table></div>
              </details>
            </section>
            <section className="card">
              <h2>Streaks</h2><p className="muted">Number of students on each streak length</p>
              <BarChart label="Students by streak length" max={Math.max(1, n(p.students))} rows={d.streaks.map(s => ({ label: STREAK_LABEL[s.label] || s.label, value: n(s.students) }))} />
            </section>
          </div>

          <section className="card">
            <h2>Missions</h2><p className="muted">Where each student stands on each mission</p>
            {d.missions.length ? (
              <div className="scroll" style={{ marginTop: 8 }}><table>
                <thead><tr><th>Mission</th><th>Subjects</th><th>Deadline</th><th className="num">Approved</th><th className="num">Waiting</th><th className="num">Rejected</th><th className="num">Not sent</th></tr></thead>
                <tbody>{d.missions.map(m => (
                  <tr key={m.id}>
                    <td><b>{m.title}</b><br /><span className="muted">{m.points} points</span></td>
                    <td>{(m.subjects || []).map(s => <span key={s.slug} className="chip an-subj" style={{ background: s.color, color: '#10140a', marginRight: '.25rem' }}><span aria-hidden="true">{s.icon}</span>{s.name}</span>)}</td>
                    <td>{m.deadline ? <>{fmtDate(m.deadline)}{m.closed && <span className="chip danger" style={{ marginLeft: '.4rem' }}>Closed</span>}</> : <span className="muted">None</span>}</td>
                    <td className="num">{n(m.approved)}</td><td className="num">{n(m.pending)}</td><td className="num">{n(m.rejected)}</td><td className="num">{n(m.not_submitted)}</td>
                  </tr>))}</tbody></table></div>
            ) : <p className="muted">No missions posted yet.</p>}
          </section>
        </>
      )}
    </>
  );
}
