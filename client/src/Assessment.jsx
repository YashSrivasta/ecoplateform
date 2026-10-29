import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { Icon, Loading, Pick } from './ui';
import { Donut } from './charts';
import './assessment.css';

const n = v => Number(v) || 0;
const COLS = [['name', 'Student'], ['grade', 'Class'], ['mission_points', 'Mission points'], ['quiz_points', 'Quiz points'], ['total', 'Total']];
// Colours also have names in the legend and the percentages are printed, so nothing depends on colour alone.
const STATUS = [['approved', 'Approved', '#d6ff00'], ['pending', 'Waiting', '#ffcf5c'], ['rejected', 'Rejected', '#ff7a6b'], ['not_submitted', 'Not sent', '#8e95a4']];

export default function Assessment() {
  const ctx = useOutletContext();
  const [rows, setRows] = useState(null), [an, setAn] = useState(null), [err, setErr] = useState('');
  const [mid, setMid] = useState(''), [sort, setSort] = useState({ key: 'total', dir: 'desc' });
  useEffect(() => {
    if (!ctx.classId) return;
    setRows(null); setAn(null); setErr(''); setMid('');
    api(`/classes/${ctx.classId}/assessment`).then(r => setRows(r.map(x => ({ ...x, mission_points: n(x.mission_points), quiz_points: n(x.quiz_points), total: n(x.mission_points) + n(x.quiz_points) })))).catch(e => { setErr(e.message); setRows([]); });
    api(`/classes/${ctx.classId}/analytics`).then(setAn).catch(() => setAn({ missions: [] }));
  }, [ctx.classId]);

  const sorted = useMemo(() => {
    const { key, dir } = sort, k = dir === 'asc' ? 1 : -1;
    return [...(rows || [])].sort((a, b) => (typeof a[key] === 'string' ? a[key].localeCompare(b[key]) : n(a[key]) - n(b[key])) * k || a.name.localeCompare(b.name));
  }, [rows, sort]);
  const toggle = key => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' || key === 'grade' ? 'asc' : 'desc' });

  const tm = (rows || []).reduce((a, r) => a + r.mission_points, 0), tq = (rows || []).reduce((a, r) => a + r.quiz_points, 0);
  const missions = an?.missions || [];
  const cur = missions.find(m => String(m.id) === String(mid)) || missions[0];

  return (
    <>
      <header className="page-head"><div><h1>Assessment</h1><p className="muted">Points earned by each student, and how the class is doing on missions.</p></div></header>
      <Pick ctx={ctx} />
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {ctx.classId && !rows && <Loading />}
      {rows && !rows.length && !err && <section className="card"><p className="muted">No students in this class yet.</p></section>}
      {rows?.length > 0 && (
        <>
          <div className="grid-2">
            <section className="card">
              <h2>Where points come from</h2><p className="muted">All points earned by this class</p>
              <div style={{ marginTop: 14 }}><Donut label="Points from missions and quizzes" center={tm + tq} slices={[{ label: 'Missions', value: tm, color: '#d6ff00' }, { label: 'Quizzes', value: tq, color: '#4da3ff' }]} /></div>
            </section>
            <section className="card">
              <h2>Mission progress</h2><p className="muted">What students have sent for one mission</p>
              {!an && <Loading />}
              {an && !missions.length && <p className="muted" style={{ marginTop: 14 }}>No missions posted yet.</p>}
              {cur && <>
                <div className="as-pick"><label className="label" htmlFor="as-m">Mission</label>
                  <select id="as-m" value={cur.id} onChange={e => setMid(e.target.value)}>{missions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></div>
                <Donut label={`Submissions for ${cur.title}`} center={rows.length} slices={STATUS.map(([k, label, color]) => ({ label, value: n(cur[k]), color }))} />
                <p className="muted" style={{ marginTop: 10 }}>Centre number: students in the class.</p>
              </>}
            </section>
          </div>
          <section className="card paper">
            <h2>Student scores</h2><p className="muted">Press a column name to sort.</p>
            <div className="scroll" style={{ marginTop: 8 }}>
              <table>
                <thead><tr>{COLS.map(([k, label], i) => (
                  <th key={k} className={i > 1 ? 'num' : ''} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sort" onClick={() => toggle(k)}>{label}{sort.key === k && <span aria-hidden="true">{sort.dir === 'asc' ? '▲' : '▼'}</span>}</button>
                  </th>))}</tr></thead>
                <tbody>{sorted.map(r => <tr key={r.name + r.grade}><td><b>{r.name}</b></td><td>{r.grade}</td><td className="num">{r.mission_points}</td><td className="num">{r.quiz_points}</td><td className="num"><span className="chip lime">{r.total}</span></td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
