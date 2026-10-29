import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { Avatar, Pick, Proof, fmtDate, useAuth, useToast } from './ui';
import MissionForm from './MissionForm';
export { default as Review } from './Review';
export { default as Students } from './Students';
export { default as Assessment } from './Assessment';
export { default as Report } from './Reports';

export function TDash() {
  const ctx = useOutletContext(), { user } = useAuth(), toast = useToast();
  const [name, setName] = useState(''), [code, setCode] = useState(''), [err, setErr] = useState('');
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
      {target && <MissionForm classes={owned} classId={target.id} onClassChange={ctx.setClassId} />}
    </>
  );
}
