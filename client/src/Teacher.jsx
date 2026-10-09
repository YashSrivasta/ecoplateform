import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { Avatar, Pick, Proof, fmtDate, useAuth, useToast } from './ui';

export function TDash() {
  const ctx = useOutletContext(), { user } = useAuth(), toast = useToast();
  const [name, setName] = useState(''), [code, setCode] = useState(''), [err, setErr] = useState('');
  const [m, setM] = useState({ title: '', description: '', points: 10 });
  const owned = ctx.classes.filter(c => c.owner);
  const target = owned.find(c => c.id === ctx.classId) || owned[0];
  const students = ctx.classes.reduce((a, c) => a + c.students, 0);
  const run = async fn => { setErr(''); try { await fn(); ctx.reload(); } catch (e) { setErr(e.message); } };
  return (
    <>
      <section className="card head-card">
        <Avatar u={user} lg />
        <div className="who"><h1>{user.name}</h1><p className="muted">{user.email}</p></div>
        <div className="tile"><span className="label">Classes</span><div className="big">{ctx.classes.length}</div></div>
        <div className="tile"><span className="label">Students</span><div className="big">{students}</div></div>
      </section>
      {err && <p className="alert">{err}</p>}
      <section className="card">
        <h2>My classes</h2>
        {ctx.classes.length === 0 && <p className="muted">You have no classes yet. Name one below to get a class code for your students.</p>}
        <div style={{ marginTop: 8 }}>
          {ctx.classes.map(c => (
            <div className="class-row" key={c.id}>
              <b>{c.name}</b>
              <span className="muted">{c.students} students</span>
              <span className="chip lime code" aria-label={`Class code ${c.code}`}>{c.code}</span>
              {!c.owner && <span className="chip warn">View only · by {c.creator}</span>}
            </div>
          ))}
        </div>
        <form className="row" onSubmit={e => { e.preventDefault(); run(async () => { const r = await api('/teacher/classes', { method: 'POST', body: { name } }); setName(''); toast('Class created. Code: ' + r.code, 8000); }); }}>
          <input aria-label="New class name" placeholder="New class name" value={name} onChange={e => setName(e.target.value)} required />
          <button className="btn btn-primary">Generate class code</button>
        </form>
        <form className="row" onSubmit={e => { e.preventDefault(); run(async () => { await api('/teacher/classes/join', { method: 'POST', body: { code } }); setCode(''); toast('Class added to your list'); }); }}>
          <input aria-label="Colleague's class code" placeholder="Code of a colleague's class (view only)" value={code} onChange={e => setCode(e.target.value)} required />
          <button className="btn btn-line">Add to my list</button>
        </form>
      </section>
      {target && (
        <form className="card paper" onSubmit={e => { e.preventDefault(); run(async () => { await api(`/classes/${target.id}/missions`, { method: 'POST', body: m }); setM({ title: '', description: '', points: 10 }); toast('Mission posted'); }); }}>
          <h2>New mission</h2><p className="muted">Students in {target.name} will see it under Tasks.</p>
          <div className="stack" style={{ gap: 12, marginTop: 12 }}>
            {owned.length > 1 && <label className="field"><span className="label">Post to class</span><select value={target.id} onChange={e => ctx.setClassId(+e.target.value)}>{owned.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
            <label className="field"><span className="label">Title</span><input placeholder="e.g. Plant a sapling" value={m.title} onChange={e => setM({ ...m, title: e.target.value })} required /></label>
            <label className="field"><span className="label">What should students do?</span><input value={m.description} onChange={e => setM({ ...m, description: e.target.value })} /></label>
            <label className="field" style={{ maxWidth: 160 }}><span className="label">Points (1–100)</span><input type="number" min="1" max="100" value={m.points} onChange={e => setM({ ...m, points: e.target.value })} required /></label>
          </div>
          <div className="row"><button className="btn btn-primary">Post mission</button></div>
        </form>
      )}
    </>
  );
}

export function Students() {
  const ctx = useOutletContext(), [rows, setRows] = useState([]);
  useEffect(() => { setRows([]); ctx.classId && api(`/classes/${ctx.classId}/students`).then(setRows).catch(() => {}); }, [ctx.classId]);
  return (
    <>
      <header className="page-head"><h1>Students</h1></header>
      <Pick ctx={ctx} />
      {rows.length === 0
        ? <section className="card paper"><p>No students yet. Share the class code so they can join.</p>{ctx.cls && <p className="muted">Class code: <span className="chip lime code">{ctx.cls.code}</span></p>}</section>
        : <section className="card paper">
          {rows.map(r => (
            <div className="person" key={r.id}>
              <Avatar u={r} />
              <div className="who"><b>{r.name}</b><span className="muted">Class {r.grade} · {r.missions_done} {r.missions_done === 1 ? 'mission' : 'missions'} done</span></div>
              <div className="score"><div className="n">{r.points}<small>pts</small></div><div className="bar" aria-label="Progress to next level"><i style={{ width: (r.points % 100) + '%' }} /></div></div>
            </div>
          ))}
        </section>}
    </>
  );
}

export function Review() {
  const ctx = useOutletContext(), toast = useToast();
  const [subs, setSubs] = useState([]), [doubts, setDoubts] = useState([]), [pts, setPts] = useState({}), [err, setErr] = useState(''), [rep, setRep] = useState({});
  const load = () => { if (!ctx.classId) return; api(`/classes/${ctx.classId}/submissions`).then(setSubs).catch(() => {}); api(`/classes/${ctx.classId}/doubts`).then(setDoubts).catch(() => {}); };
  useEffect(() => { setSubs([]); setDoubts([]); load(); }, [ctx.classId]);
  const review = async (s, approve) => {
    try { await api(`/submissions/${s.id}/review`, { method: 'POST', body: { approve, points: pts[s.id] ?? s.max_points } }); setErr(''); toast(approve ? 'Work accepted successfully.' : 'Submission rejected.'); load(); } catch (e) { setErr(e.message); }
  };
  const reply = async d => { try { await api(`/doubts/${d.id}/reply`, { method: 'POST', body: { reply: rep[d.id] } }); setErr(''); toast('Reply sent'); load(); } catch (e) { setErr(e.message); } };
  const owner = ctx.cls?.owner;
  return (
    <>
      <header className="page-head"><h1>Review</h1></header>
      <Pick ctx={ctx} />
      {ctx.cls && !owner && <p className="chip warn" style={{ alignSelf: 'flex-start' }}>You can view this class, but only {ctx.cls.creator} can approve or reject.</p>}
      {err && <p className="alert">{err}</p>}
      {subs.length === 0 && <p className="muted">No submissions yet.</p>}
      <div className="stack">
        {subs.map(s => (
          <article className="card sub" key={s.id}>
            <Proof src={s.photo} name={s.student} />
            <div className="sub-info"><h3>{s.title}</h3><p className="muted">{s.student} · {fmtDate(s.created_at)}</p><div className="chips"><span className="chip">Max {s.max_points} pts</span></div></div>
            <div className="sub-actions">
              {s.status === 'pending' && owner && <>
                <input type="number" min="0" max={s.max_points} defaultValue={s.max_points} aria-label={`Points for ${s.student}`} onChange={e => setPts({ ...pts, [s.id]: e.target.value })} />
                <button className="btn btn-primary" onClick={() => review(s, true)}>Approve</button>
                <button className="btn btn-danger" onClick={() => review(s, false)}>Reject</button>
              </>}
              {s.status === 'pending' && !owner && <span className="chip warn">Pending</span>}
              {s.status === 'approved' && <span className="chip lime">Approved +{s.awarded}</span>}
              {s.status === 'rejected' && <span className="chip danger">Rejected</span>}
            </div>
          </article>
        ))}
      </div>
      <h2 style={{ marginTop: 14 }}>Student doubts</h2>
      {doubts.length === 0 && <p className="muted">No doubts yet.</p>}
      <div className="stack">
        {doubts.map(d => (
          <article className="card paper" key={d.id}>
            <p><b>{d.student}</b> <span className="muted">asks</span></p><p>{d.message}</p>
            {d.reply ? <p className="bubble teacher" style={{ marginTop: 10 }}><small>Your reply</small>{d.reply}</p>
              : owner && <div className="row"><input aria-label={`Reply to ${d.student}`} placeholder="Write a reply" value={rep[d.id] || ''} onChange={e => setRep({ ...rep, [d.id]: e.target.value })} /><button className="btn btn-primary" onClick={() => reply(d)} disabled={!(rep[d.id] || '').trim()}>Reply</button></div>}
          </article>
        ))}
      </div>
    </>
  );
}

export function Assessment() {
  const ctx = useOutletContext(), [rows, setRows] = useState([]);
  useEffect(() => { setRows([]); ctx.classId && api(`/classes/${ctx.classId}/assessment`).then(setRows).catch(() => {}); }, [ctx.classId]);
  return (
    <>
      <header className="page-head"><h1>Assessment</h1></header>
      <Pick ctx={ctx} />
      <section className="card paper scroll">
        {rows.length === 0 ? <p className="muted">No students in this class yet.</p> :
          <table><thead><tr><th>Student</th><th>Class</th><th className="num">Mission points</th><th className="num">Quiz points</th><th className="num">Total</th></tr></thead>
            <tbody>{rows.map(r => <tr key={r.name}><td><b>{r.name}</b></td><td>{r.grade}</td><td className="num">{r.mission_points}</td><td className="num">{r.quiz_points}</td><td className="num"><span className="chip lime">{r.mission_points + r.quiz_points}</span></td></tr>)}</tbody></table>}
      </section>
    </>
  );
}

export function Report() {
  const ctx = useOutletContext(), [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { setD(null); setErr(''); ctx.classId && api(`/classes/${ctx.classId}/report`).then(setD).catch(e => setErr(e.message)); }, [ctx.classId]);
  const top = d && [...d.students].sort((a, b) => b.total - a.total)[0];
  return (
    <>
      <header className="page-head"><h1>Class report</h1><button className="btn btn-white no-print" onClick={() => window.print()} disabled={!d}>Print or save as PDF</button></header>
      <Pick ctx={ctx} />
      {err && <p className="alert">{err}</p>}
      {ctx.classId && !d && !err && <p className="muted">Preparing the report…</p>}
      {d && <>
        <div className="stats-3">
          <div className="card stat"><span className="label">Students</span><div className="big">{d.students.length}</div></div>
          <div className="card stat"><span className="label">Missions posted</span><div className="big">{d.missions}</div></div>
          <div className="card stat"><span className="label">Class average</span><div className="big">{d.avg}<span className="unit">pts</span></div></div>
        </div>
        <section className="card">
          <h2>{d.class}</h2>
          <p className="summary">{d.students.length ? `${d.students.length} students have earned an average of ${d.avg} points across ${d.missions} missions.${top ? ` ${top.name} leads with ${top.total} points.` : ''}` : 'No students have joined this class yet.'}</p>
        </section>
        {d.students.length > 0 && <section className="card paper scroll">
          <table><thead><tr><th>Student</th><th className="num">Missions approved</th><th className="num">Rejected</th><th className="num">Waiting</th><th className="num">Quizzes correct</th><th className="num">Total points</th></tr></thead>
            <tbody>{d.students.map(r => <tr key={r.name}><td><b>{r.name}</b></td><td className="num">{r.approved}/{d.missions}</td><td className="num">{r.rejected}</td><td className="num">{r.pending}</td><td className="num">{r.quiz_right}/{r.quiz_tried}</td><td className="num"><span className="chip lime">{r.total}</span></td></tr>)}</tbody></table>
        </section>}
      </>}
    </>
  );
}
