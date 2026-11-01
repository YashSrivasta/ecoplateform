import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { Icon, Loading, Pick, fmtDate, useToast } from './ui';
import './announcements.css';

export default function Announcements() {
  const ctx = useOutletContext(), toast = useToast();
  const [list, setList] = useState(null), [f, setF] = useState({ title: '', body: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const owner = ctx.cls?.owner;
  const load = () => ctx.classId && api(`/classes/${ctx.classId}/announcements`).then(setList).catch(e => { setErr(e.message); setList([]); });
  useEffect(() => { setList(null); setErr(''); load(); }, [ctx.classId]);

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api(`/classes/${ctx.classId}/announcements`, { method: 'POST', body: f }); setF({ title: '', body: '' }); toast('Announcement posted'); load(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const remove = async a => {
    if (!window.confirm('Delete this announcement? Students will no longer see it.')) return;
    try { await api(`/classes/${ctx.classId}/announcements/${a.id}`, { method: 'DELETE' }); toast('Announcement deleted'); load(); } catch (x) { setErr(x.message); }
  };

  return (
    <>
      <header className="page-head"><div><h1>Announcements</h1><p className="muted">Post a notice for one class. Students in that class see it on their dashboard.</p></div></header>
      <Pick ctx={ctx} />
      {ctx.cls && !owner && <p className="chip warn" style={{ alignSelf: 'flex-start' }}>You can view this class, but only {ctx.cls.creator} can post or delete announcements.</p>}
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {ctx.classId && owner && (
        <form className="card paper" onSubmit={submit}>
          <h2>New announcement</h2><p className="muted">For {ctx.cls.name}.</p>
          <div className="stack" style={{ gap: '.75rem', marginTop: '.75rem' }}>
            <label className="field"><span className="label">Title</span>
              <input required minLength={3} maxLength={100} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
            <label className="field"><span className="label">Message (optional)</span>
              <textarea rows={3} maxLength={1000} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></label>
          </div>
          <div className="row"><button className="btn btn-primary" disabled={busy}><Icon name="plus" size={18} />Post announcement</button></div>
        </form>
      )}
      <h2 style={{ marginTop: '.5rem' }}>Posted for this class</h2>
      {ctx.classId && !list && <Loading />}
      {list && !list.length && !err && <p className="muted">Nothing posted yet.</p>}
      <div className="stack">
        {(list || []).map(a => (
          <article className="card" key={a.id}>
            <p className="muted an-date">{fmtDate(a.created_at)}</p>
            <h3 className="an-title">{a.title}</h3>
            {a.body && <p className="an-body">{a.body}</p>}
            {owner && <div className="row"><button type="button" className="btn btn-danger" onClick={() => remove(a)}>Delete</button></div>}
          </article>
        ))}
      </div>
    </>
  );
}
