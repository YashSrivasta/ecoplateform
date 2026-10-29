import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, download } from './api';
import { Icon, Loading, Pick, fmtDate, useToast } from './ui';
import { BarChart } from './charts';
import './reports.css';

const n = v => Number(v) || 0;
const pc = v => (v == null ? '–' : n(v) + '%');
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'class';

function ClassReport({ ctx }) {
  const toast = useToast();
  const [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    if (!ctx.classId) return;
    setD(null); setErr('');
    Promise.all([api(`/classes/${ctx.classId}/analytics`), api(`/classes/${ctx.classId}/assessment`), api(`/classes/${ctx.classId}/students`)])
      .then(([an, as, st]) => setD({ an, st: st.map(s => { const a = as.find(x => x.name === s.name && String(x.grade) === String(s.grade)); return { ...s, mission_points: n(a?.mission_points), quiz_points: n(a?.quiz_points) }; }) }))
      .catch(e => setErr(e.message));
  }, [ctx.classId]);
  const csv = async () => { try { await download(`/classes/${ctx.classId}/export.csv`, `${slug(ctx.cls?.name)}-students.csv`); } catch (e) { toast(e.message); } };
  const top = d && [...d.st].sort((a, b) => n(b.points) - n(a.points))[0];
  const p = d?.an.performance;
  return (
    <>
      <Pick ctx={ctx} />
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {ctx.classId && !d && !err && <Loading text="Preparing the report…" />}
      {d && (
        <>
          <div className="rp-tools">
            <button type="button" className="btn btn-primary" onClick={csv}><Icon name="download" size={18} />Download for Excel (CSV)</button>
            <button type="button" className="btn btn-line" onClick={() => window.print()}><Icon name="print" size={18} />Print or save as PDF</button>
          </div>
          <div className="rp-sheet-head"><h1>EcoQuest class report</h1><p>{ctx.cls?.name} · {fmtDate(new Date())}</p></div>
          <section className="card">
            <h2>{ctx.cls?.name}</h2>
            <p className="summary">{n(p.students) ? `${n(p.students)} students have earned an average of ${n(p.avg_points)} points. Quiz accuracy is ${pc(p.accuracy)} across ${n(p.quiz_attempts)} answers, and ${d.an.missions.length} ${d.an.missions.length === 1 ? 'mission has' : 'missions have'} been posted.${top && n(top.points) > 0 ? ` ${top.name} leads with ${n(top.points)} points.` : ''}` : 'No students have joined this class yet.'}</p>
          </section>
          {n(p.students) > 0 && <>
            <div className="stats-3">
              <div className="card stat"><span className="label">Students</span><div className="big">{n(p.students)}</div></div>
              <div className="card stat"><span className="label">Class average</span><div className="big">{n(p.avg_points)}<span className="unit">pts</span></div></div>
              <div className="card stat"><span className="label">Quiz accuracy</span><div className="big">{p.accuracy == null ? '–' : n(p.accuracy)}{p.accuracy != null && <span className="unit">%</span>}</div></div>
            </div>
            <section className="card">
              <h2>Accuracy by subject</h2>
              <BarChart label="Quiz accuracy by subject" unit="%" max={100} rows={d.an.subjects.map(s => ({ label: `${s.icon} ${s.name}`, value: s.accuracy == null ? 0 : n(s.accuracy), color: s.color }))} />
            </section>
            <section className="card paper">
              <h2>Students</h2>
              <div className="scroll" style={{ marginTop: 8 }}><table>
                <thead><tr><th>Student</th><th>Class</th><th className="num">Missions done</th><th className="num">Mission points</th><th className="num">Quiz points</th><th className="num">Total points</th></tr></thead>
                <tbody>{d.st.map(s => <tr key={s.id}><td><b>{s.name}</b></td><td>{s.grade}</td><td className="num">{n(s.missions_done)}</td><td className="num">{s.mission_points}</td><td className="num">{s.quiz_points}</td><td className="num"><span className="chip lime">{n(s.points)}</span></td></tr>)}</tbody></table></div>
            </section>
            <section className="card paper">
              <h2>Missions</h2>
              {d.an.missions.length ? <div className="scroll" style={{ marginTop: 8 }}><table>
                <thead><tr><th>Mission</th><th>Deadline</th><th className="num">Approved</th><th className="num">Waiting</th><th className="num">Rejected</th><th className="num">Not sent</th></tr></thead>
                <tbody>{d.an.missions.map(m => <tr key={m.id}><td><b>{m.title}</b></td><td>{m.deadline ? fmtDate(m.deadline) : 'None'}</td><td className="num">{n(m.approved)}</td><td className="num">{n(m.pending)}</td><td className="num">{n(m.rejected)}</td><td className="num">{n(m.not_submitted)}</td></tr>)}</tbody></table></div> : <p className="muted">No missions posted yet.</p>}
            </section>
          </>}
        </>
      )}
    </>
  );
}

const METRICS = [['accuracy', 'Quiz accuracy', '%'], ['active_rate', 'Active in last 7 days', '%'], ['mission_rate', 'Missions approved', '%'], ['avg_points', 'Average points', ''], ['avg_streak', 'Average streak (days)', '']];

function Compare({ ctx }) {
  const toast = useToast();
  const [sel, setSel] = useState(() => ctx.classes.slice(0, 10).map(c => c.id));
  const [d, setD] = useState(null), [err, setErr] = useState(''), [metric, setMetric] = useState('accuracy');
  const q = sel.join(',');
  useEffect(() => {
    if (!sel.length) { setD({ classes: [], subjects: [] }); return; }
    setD(null); setErr('');
    api(`/reports/class-comparison?classes=${q}`).then(setD).catch(e => setErr(e.message));
  }, [q]);
  const flip = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : s.length < 10 ? [...s, id] : s));
  const csv = async () => { try { await download(`/reports/class-comparison?classes=${q}&format=csv`, 'class-comparison.csv'); } catch (e) { toast(e.message); } };
  const m = METRICS.find(x => x[0] === metric);
  const rows = useMemo(() => (d?.classes || []).map(c => ({ label: c.name, value: c[metric] == null ? 0 : n(c[metric]) })), [d, metric]);
  return (
    <>
      {ctx.classes.length < 2 && <p className="muted">You only have one class, so there is nothing to compare yet. Add a colleague's class from the Dashboard (view only) to compare.</p>}
      <fieldset className="rp-pick" aria-label="Classes to compare"><legend className="label">Classes to compare (up to 10)</legend>
        {ctx.classes.map(c => <label key={c.id}><input type="checkbox" checked={sel.includes(c.id)} onChange={() => flip(c.id)} />{c.name}</label>)}
      </fieldset>
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {!d && !err && <Loading />}
      {d?.classes.length > 0 && (
        <>
          <div className="rp-tools">
            <button type="button" className="btn btn-primary" onClick={csv}><Icon name="download" size={18} />Download for Excel (CSV)</button>
            <button type="button" className="btn btn-line" onClick={() => window.print()}><Icon name="print" size={18} />Print or save as PDF</button>
          </div>
          <div className="rp-sheet-head"><h1>EcoQuest class comparison</h1><p>{fmtDate(new Date())}</p></div>
          <section className="card">
            <div className="between row" style={{ margin: 0 }}><h2>Compare on one measure</h2>
              <div className="filters" style={{ maxWidth: '22rem' }}><label className="label" htmlFor="rp-m">Measure</label><select id="rp-m" value={metric} onChange={e => setMetric(e.target.value)}>{METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div></div>
            <BarChart label={m[1] + ' by class'} unit={m[2]} max={m[2] === '%' ? 100 : undefined} rows={rows} />
          </section>
          <section className="card paper">
            <h2>All measures</h2>
            <div className="scroll" style={{ marginTop: 8 }}><table>
              <thead><tr><th>Class</th><th className="num">Students</th><th className="num">Avg points</th><th className="num">Quiz accuracy</th><th className="num">Active 7 days</th><th className="num">Missions approved</th><th className="num">Avg streak</th>{d.subjects.map(s => <th className="num" key={s.slug}>{s.name}</th>)}</tr></thead>
              <tbody>{d.classes.map(c => <tr key={c.class_id}><td><b>{c.name}</b></td><td className="num">{n(c.students)}</td><td className="num">{n(c.avg_points)}</td><td className="num">{pc(c.accuracy)}</td><td className="num">{pc(c.active_rate)}</td><td className="num">{pc(c.mission_rate)}</td><td className="num">{n(c.avg_streak)}</td>{d.subjects.map(s => <td className="num" key={s.slug}>{pc(c.subjects?.[s.slug])}</td>)}</tr>)}</tbody></table></div>
            <p className="muted" style={{ marginTop: '.5rem' }}>Subject columns show quiz accuracy. A dash means no answers yet.</p>
          </section>
        </>
      )}
    </>
  );
}

export default function Reports() {
  const ctx = useOutletContext();
  const [tab, setTab] = useState('class');
  return (
    <>
      <header className="page-head"><div><h1>Reports</h1><p className="muted">A summary you can print, or download to open in Excel.</p></div></header>
      <div className="rp-tools"><div className="seg" role="group" aria-label="Report type">
        <button type="button" className={tab === 'class' ? 'on' : ''} aria-pressed={tab === 'class'} onClick={() => setTab('class')}>One class</button>
        <button type="button" className={tab === 'compare' ? 'on' : ''} aria-pressed={tab === 'compare'} onClick={() => setTab('compare')}>Compare classes</button></div></div>
      {tab === 'class' ? <ClassReport ctx={ctx} /> : <Compare ctx={ctx} />}
    </>
  );
}
