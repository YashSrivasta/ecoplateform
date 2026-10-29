import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { Avatar, Icon, Loading, Pick, fmtDate } from './ui';
import PortfolioView from './Portfolio';
import './students.css';

const n = v => Number(v) || 0;

function Detail({ classId, s, onBack }) {
  const [p, setP] = useState(null), [err, setErr] = useState('');
  useEffect(() => { setP(null); setErr(''); api(`/classes/${classId}/students/${s.id}/portfolio`).then(setP).catch(e => setErr(e.message)); }, [classId, s.id]);
  return (
    <>
      <div className="rp-tools no-print" style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-line" onClick={onBack}><Icon name="close" size={18} />Back to students</button>
        <button type="button" className="btn btn-line" onClick={() => window.print()} disabled={!p}><Icon name="print" size={18} />Print or save as PDF</button>
      </div>
      <section className="card">
        <div className="st-head">
          <Avatar u={s} lg />
          <div className="who"><h1 style={{ fontSize: '2rem' }}>{s.name}</h1><p className="muted">Class {s.grade}{p?.student?.joined ? ` · joined ${fmtDate(p.student.joined)}` : ''}</p></div>
        </div>
      </section>
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {!p && !err && <Loading />}
      {p && <section className="card"><h2>Portfolio</h2><p className="muted">Quizzes, missions and badges in every subject</p><PortfolioView p={p} /></section>}
    </>
  );
}

export default function Students() {
  const ctx = useOutletContext();
  const [rows, setRows] = useState(null), [err, setErr] = useState(''), [q, setQ] = useState(''), [sort, setSort] = useState('name'), [open, setOpen] = useState(null);
  useEffect(() => { setRows(null); setErr(''); setOpen(null); ctx.classId && api(`/classes/${ctx.classId}/students`).then(setRows).catch(e => { setErr(e.message); setRows([]); }); }, [ctx.classId]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter(r => !t || r.name.toLowerCase().includes(t)).sort((a, b) => sort === 'points' ? n(b.points) - n(a.points) : sort === 'missions' ? n(b.missions_done) - n(a.missions_done) : a.name.localeCompare(b.name));
  }, [rows, q, sort]);

  if (open) return <Detail classId={ctx.classId} s={open} onBack={() => setOpen(null)} />;
  return (
    <>
      <header className="page-head"><div><h1>Students</h1><p className="muted">Open a student to see their portfolio.</p></div></header>
      <Pick ctx={ctx} />
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {ctx.classId && !rows && <Loading />}
      {rows && !rows.length && !err && <section className="card paper"><p>No students yet. Share the class code so they can join.</p>{ctx.cls && <p className="muted">Class code: <span className="chip lime code">{ctx.cls.code}</span></p>}</section>}
      {rows?.length > 0 && (
        <>
          <div className="st-tools">
            <input type="search" aria-label="Search students by name" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} />
            <select aria-label="Sort students" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Sort by name</option><option value="points">Most points</option><option value="missions">Most missions done</option></select>
          </div>
          <p className="muted" role="status" aria-live="polite">{shown.length} of {rows.length} students</p>
          <section className="card paper">
            {!shown.length && <p className="muted">No student matches "{q}".</p>}
            {shown.map(r => (
              <div className="st-row" key={r.id}>
                <Avatar u={r} />
                <div className="who"><b>{r.name}</b><span className="muted">Class {r.grade} · {n(r.missions_done)} {n(r.missions_done) === 1 ? 'mission' : 'missions'} done</span></div>
                <div className="score"><div className="n">{n(r.points)}<small>pts</small></div><div className="bar" role="progressbar" aria-valuenow={n(r.points) % 100} aria-valuemin="0" aria-valuemax="100" aria-label={`${r.name}: progress to next level`}><i style={{ width: (n(r.points) % 100) + '%' }} /></div></div>
                <button type="button" className="btn btn-line" onClick={() => setOpen(r)} aria-label={`Open ${r.name}'s portfolio`}>Portfolio</button>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
