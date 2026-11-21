import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Avatar, Icon, Loading, useAuth, useToast } from './ui';

// Change-name box for students and teachers.
// showName={false}: page already shows the name, so only the "Change name" button is drawn.
// onSaved: optional, called after a successful save (e.g. to reload the page data).
export function NameEditor({ showName = true, onSaved }) {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const input = useRef(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);

  const cancel = () => { setEditing(false); setName(user.name); setErr(''); };
  const save = async e => {
    e.preventDefault();
    const clean = name.replace(/\s+/g, ' ').trim();
    if (clean === user.name) return cancel();
    setBusy(true); setErr('');
    try {
      const d = await api('/me/name', { method: 'PUT', body: { name: clean } });
      updateUser(d.user);
      toast('Name updated');
      setEditing(false);
      onSaved?.(d.user);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  if (!editing) {
    return (
      <div className="no-print" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {showName && <div><span className="label">Name</span><div><strong>{user.name}</strong></div></div>}
        <button type="button" className="btn btn-line" onClick={() => { setName(user.name); setEditing(true); }}>Change name</button>
      </div>
    );
  }
  return (
    <form className="no-print" onSubmit={save} noValidate>
      <label className="label" htmlFor="new-name">Name</label>
      <input id="new-name" ref={input} value={name} maxLength={60} autoComplete="name"
        aria-invalid={!!err} aria-describedby={err ? 'name-err' : undefined}
        onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Escape' && cancel()} />
      {err && <p id="name-err" className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={busy || name.trim().length < 2}>{busy ? 'Saving…' : 'Save name'}</button>
        <button type="button" className="btn btn-line" onClick={cancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

// Teacher profile page: photo, name (editable), email, and the classes they teach or view.
export function TeacherProfile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [classes, setClasses] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/teacher/classes').then(setClasses).catch(() => setClasses([])); }, []);

  const photo = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErr('Please choose a photo (an image file).');
    if (f.size > 5 * 1024 * 1024) return setErr('That photo is bigger than 5 MB. Please choose a smaller one.');
    const form = new FormData(); form.append('photo', f);
    setErr('');
    try { const d = await api('/me/photo', { method: 'POST', form }); updateUser({ ...user, photo: d.photo }); toast('Photo updated'); }
    catch (e2) { setErr(e2.message); }
  };

  const mine = (classes || []).filter(c => c.owner);
  const viewing = (classes || []).filter(c => !c.owner);
  return (
    <>
      <header className="page-head"><div><h1>Profile</h1><p className="muted">Your details and the classes you teach.</p></div></header>
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      <div className="profile-grid">
        <section className="card">
          <Avatar u={user} lg />
          <h2 style={{ marginTop: '1rem', fontSize: '1.75rem' }}>{user.name}</h2>
          <p className="muted">{user.email}</p>
          <p>Teacher</p>
          <div className="photo-row">
            <label className="btn btn-line"><Icon name="upload" size={18} />Change photo<input className="file-input" type="file" accept="image/*" onChange={photo} /></label>
          </div>
          <div style={{ marginTop: '1.25rem' }}><NameEditor showName={false} /></div>
        </section>
        <section className="card">
          <h2>My classes</h2>
          {!classes ? <Loading /> : !classes.length ? <p className="muted">No classes yet. Create one on the Dashboard.</p> : (
            <>
              {mine.map(c => <p key={c.id}>{c.name} <span className="muted">· code {c.code} · {c.students} student{c.students === 1 ? '' : 's'}</span></p>)}
              {viewing.length > 0 && <><h3 style={{ marginTop: '1.5rem' }}>View only</h3>{viewing.map(c => <p key={c.id}>{c.name} <span className="muted">· by {c.creator}</span></p>)}</>}
            </>
          )}
        </section>
      </div>
    </>
  );
}
