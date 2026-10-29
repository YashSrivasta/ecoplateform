import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { Icon, Loading, fmtDate, useToast } from './ui';
import MissionForm from './MissionForm';
import './projects.css';

const n = v => Number(v) || 0;
const STATUS = { accepted: ['Joined', 'lime'], pending: ['Invited, waiting', 'warn'], declined: ['Declined', 'danger'] };

function Invites({ list, onAnswer }) {
  const rows = list.flatMap(p => p.invites_for_me.map(c => ({ p, c })));
  if (!rows.length) return null;
  return (
    <section className="card" aria-label="Project invitations">
      <h2>Invitations</h2><p className="muted">Another teacher wants your class to join a project. Students only see a project after you accept.</p>
      <div style={{ marginTop: '.5rem' }}>
        {rows.map(({ p, c }) => (
          <div className="pj-invite" key={p.id + '-' + c.class_id}>
            <div className="txt"><b>{p.title}</b><br /><span className="muted">From {p.owner} · for your class {c.class}</span></div>
            <button type="button" className="btn btn-primary" onClick={() => onAnswer(p, c, true)}>Accept</button>
            <button type="button" className="btn btn-line" onClick={() => onAnswer(p, c, false)}>Decline</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Project({ p, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(false), [post, setPost] = useState(false), [det, setDet] = useState(null), [code, setCode] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const mine = p.classes.filter(c => c.mine && c.status === 'accepted').map(c => ({ id: c.class_id, name: c.class }));
  const joined = mine.length > 0;
  const loadDetail = () => api(`/projects/${p.id}`).then(setDet).catch(e => setErr(e.message));
  const toggle = () => { const o = !open; setOpen(o); if (o && !det) loadDetail(); };
  const invite = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api(`/projects/${p.id}/invite`, { method: 'POST', body: { code } });
      toast(r.status === 'accepted' ? `${r.class} added to the project` : `Invite sent to ${r.class}. Their teacher needs to accept.`, 6000);
      setCode(''); onChanged(); loadDetail();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <article className="card pj-card">
      <div className="pj-top">
        <div style={{ minWidth: 0 }}><h3>{p.title}</h3><p className="muted">Started by {p.mine ? 'you' : p.owner}{p.created_at ? ` on ${fmtDate(p.created_at)}` : ''}</p></div>
        <button type="button" className="btn btn-line" aria-expanded={open} onClick={toggle}>{open ? 'Hide details' : 'Details'}</button>
      </div>
      {p.description && <p>{p.description}</p>}
      <div className="pj-classes" aria-label="Classes in this project">
        {p.classes.map(c => { const [label, tone] = STATUS[c.status] || [c.status, '']; return <span key={c.class_id} className={'chip ' + tone}>{c.class} <small>· {c.mine ? 'you' : c.teacher}</small> · {label}</span>; })}
      </div>
      {open && (
        <div className="pj-body">
          {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
          {!det && !err && <Loading />}
          {det?.progress && (
            <>
              <h4>Progress by class</h4>
              <div className="scroll"><table><thead><tr><th>Class</th><th className="num">Students</th><th className="num">Project missions</th><th className="num">Approved</th><th className="num">Points</th></tr></thead>
                <tbody>{det.progress.map(r => <tr key={r.class_id}><td><b>{r.class}</b></td><td className="num">{n(r.students)}</td><td className="num">{n(r.missions)}</td><td className="num">{n(r.approved)}</td><td className="num">{n(r.points)}</td></tr>)}</tbody></table></div>
              <p className="muted" style={{ marginTop: '.5rem' }}>You only see totals for each class, never other classes' students.</p>
            </>
          )}
          {det && !det.progress && <p className="muted">Accept the invitation for your class to see progress.</p>}
          {joined && (
            <div style={{ marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-line" aria-expanded={post} onClick={() => setPost(v => !v)}><Icon name="plus" size={18} />Post a mission to this project</button>
              {post && <div className="pj-body"><MissionForm bare title="New project mission" classes={mine} projectId={p.id} onPosted={() => { setPost(false); loadDetail(); }} /></div>}
            </div>
          )}
          {joined && (
            <form className="row" onSubmit={invite} style={{ marginTop: '1rem' }}>
              <input aria-label="Class code to invite" placeholder="Class code to invite" value={code} onChange={e => setCode(e.target.value)} required />
              <button className="btn btn-primary" disabled={busy}>Invite class</button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

export default function Projects() {
  const ctx = useOutletContext(), toast = useToast();
  const own = ctx.classes.filter(c => c.owner);
  const [list, setList] = useState(null), [err, setErr] = useState(''), [f, setF] = useState({ title: '', description: '', class_id: '' }), [busy, setBusy] = useState(false);
  const load = () => api('/projects').then(setList).catch(e => { setErr(e.message); setList([]); });
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!f.class_id && own[0]) setF(x => ({ ...x, class_id: own[0].id })); }, [own.length]);
  const create = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api('/projects', { method: 'POST', body: { ...f, class_id: +f.class_id } }); setF({ ...f, title: '', description: '' }); toast('Project created'); load(); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const answer = async (p, c, accept) => {
    try { await api(`/projects/${p.id}/respond`, { method: 'POST', body: { class_id: c.class_id, accept } }); toast(accept ? `${c.class} joined ${p.title}` : 'Invitation declined'); load(); } catch (x) { setErr(x.message); }
  };
  return (
    <>
      <header className="page-head"><div><h1>Projects</h1><p className="muted">Work with another teacher's class on a shared project. Each teacher reviews their own students.</p></div></header>
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {list && <Invites list={list} onAnswer={answer} />}
      <form className="card paper" onSubmit={create}>
        <h2>Start a project</h2>
        {!own.length ? <p className="muted">Create a class on the Dashboard first.</p> : (
          <div className="stack" style={{ gap: '.75rem', marginTop: '.75rem' }}>
            <label className="field"><span className="label">Project title</span><input required maxLength="120" placeholder="e.g. Green Week" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
            <label className="field"><span className="label">What is it about? (optional)</span><input maxLength="1000" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
            {own.length > 1 && <label className="field"><span className="label">Your class</span><select value={f.class_id} onChange={e => setF({ ...f, class_id: e.target.value })}>{own.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
            <div className="row" style={{ margin: 0 }}><button className="btn btn-primary" disabled={busy}>Create project</button></div>
          </div>
        )}
      </form>
      {!list && <Loading />}
      {list && !list.length && <p className="muted">No projects yet. Create one above, then invite another class with its class code.</p>}
      <div className="stack">{(list || []).map(p => <Project key={p.id} p={p} onChanged={load} />)}</div>
    </>
  );
}
