import { Fragment, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { Avatar, Pick, Proof, fmtDate, useAuth, useToast } from './ui';
import MissionForm from './MissionForm';
import ClassFootprint from './ClassFootprint';
import { ShareButtons, NewClassPanel } from './ShareClass';
import { RemovePanel } from './RemoveClass';
export { default as Review } from './Review';
export { default as Students } from './Students';
export { default as Assessment } from './Assessment';
export { default as Report } from './Reports';

export function TDash() {
  const ctx = useOutletContext(), { user } = useAuth(), toast = useToast();
  const [name, setName] = useState(''), [code, setCode] = useState(''), [err, setErr] = useState(''), [fresh, setFresh] = useState(null), [removing, setRemoving] = useState(null);
  const owned = ctx.classes.filter(c => c.owner);
  const target = owned.find(c => c.id === ctx.classId) || owned[0];
  const students = ctx.classes.reduce((a, c) => a + c.students, 0);
  const run = async fn => { setErr(''); try { await fn(); ctx.reload(); } catch (e) { setErr(e.message); } };
  // a colleague's view-only class: take it off my list (nothing is deleted)
  const leaveView = c => {
    if (!window.confirm(`Remove "${c.name}" from your list? Nothing is deleted. You can add it again with its class code.`)) return;
    run(async () => { await api(`/classes/${c.id}/leave-view`, { method: 'POST' }); toast('Removed from your list'); });
  };
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
        {fresh && <NewClassPanel {...fresh} onClose={() => setFresh(null)} />}
        <div style={{ marginTop: 8 }}>
          {ctx.classes.map(c => (
            <Fragment key={c.id}>
            <div className="class-row">
              <b>{c.name}</b>
              <span className="muted">{c.students} students</span>
              <span className="chip lime code" aria-label={`Class code ${c.code}`}>{c.code}</span>
              {c.owner && <ShareButtons code={c.code} name={c.name} />}
              {c.owner && <button type="button" className="btn btn-danger" aria-expanded={removing === c.id} aria-label={`Remove class ${c.name}`} onClick={() => setRemoving(removing === c.id ? null : c.id)}>Remove class</button>}
              {!c.owner && <span className="chip warn">View only · by {c.creator}</span>}
              {!c.owner && <button type="button" className="btn btn-line" aria-label={`Remove ${c.name} from my list`} onClick={() => leaveView(c)}>Remove from my list</button>}
            </div>
            {removing === c.id && <RemovePanel cls={c} onClose={() => setRemoving(null)} onDone={() => { setRemoving(null); setFresh(null); ctx.reload(); }} />}
            </Fragment>
          ))}
        </div>
        <form className="row" onSubmit={e => { e.preventDefault(); run(async () => { const r = await api('/teacher/classes', { method: 'POST', body: { name } }); setFresh({ name: name.trim(), code: r.code }); setName(''); toast('Class created'); }); }}>
          <input aria-label="New class name" placeholder="New class name" value={name} onChange={e => setName(e.target.value)} required />
          <button className="btn btn-primary">Generate class code</button>
        </form>
        <form className="row" onSubmit={e => { e.preventDefault(); run(async () => { await api('/teacher/classes/join', { method: 'POST', body: { code } }); setCode(''); toast('Class added to your list'); }); }}>
          <input aria-label="Colleague's class code" placeholder="Code of a colleague's class (view only)" value={code} onChange={e => setCode(e.target.value)} required />
          <button className="btn btn-line">Add to my list</button>
        </form>
      </section>
      <ClassFootprint ctx={ctx} />
      {target && <MissionForm classes={owned} classId={target.id} onClassChange={ctx.setClassId} />}
    </>
  );
}
