import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Avatar, Icon, Loading, useToast } from './ui';
import PortfolioView from './Portfolio';
import './profile.css';

const MAX = 5 * 1024 * 1024;

export default function Profile() {
  const [d, setD] = useState(null);
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const toast = useToast();
  const load = () => {
    api('/student/dashboard').then(setD).catch(e => setErr(e.message));
    api('/student/portfolio').then(setP).catch(e => setErr(e.message));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);

  const clear = () => { setFile(null); setUrl(null); if (input.current) input.current.value = ''; };
  const pick = e => {
    const f = e.target.files[0]; setErr('');
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Please choose a photo (an image file).'); return clear(); }
    if (f.size > MAX) { setErr('That photo is bigger than 5 MB. Please choose a smaller one.'); return clear(); }
    setFile(f); setUrl(URL.createObjectURL(f));
  };
  const save = async () => {
    setBusy(true); setErr('');
    const form = new FormData(); form.append('photo', file);
    try {
      await api('/me/photo', { method: 'POST', form });
      toast('Photo updated'); clear(); load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (err && !d) return <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>;
  if (!d || !p) return <Loading />;
  return (
    <>
      <header className="page-head"><div><h1>Profile</h1><p className="muted">Your details and a summary of everything you have achieved.</p></div>
        <button type="button" className="btn btn-line no-print" onClick={() => window.print()}><Icon name="print" size={18} />Print or save as PDF</button></header>
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      <div className="profile-grid">
        <section className="card">
          <Avatar u={d.user} lg />
          <h2 style={{ marginTop: '1rem', fontSize: '1.75rem' }}>{d.user.name}</h2>
          <p className="muted">{d.user.email}</p>
          <p>Class {d.user.grade} · {d.points} points · Level {d.level}</p>
          <div className="photo-row no-print">
            {file ? <>
              <img className="prev" src={url} alt="Preview of your new profile photo" />
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save photo'}</button>
              <button type="button" className="btn btn-line" onClick={clear} disabled={busy}>Cancel</button>
            </> : <label className="btn btn-line"><Icon name="upload" size={18} />Change photo<input ref={input} className="file-input" type="file" accept="image/*" onChange={pick} /></label>}
          </div>
          <h3 style={{ marginTop: '1.75rem' }}>My classes</h3>
          {d.classes.length ? d.classes.map(c => <p key={c.id}>{c.name} <span className="muted">· teacher {c.teacher}</span></p>) : <p className="muted">Not in a class yet. Join one from the Dashboard.</p>}
        </section>
        <section className="card">
          <div className="pf-head"><div><h2>My portfolio</h2><p className="muted">Quizzes, missions and badges in every subject</p></div></div>
          <PortfolioView p={p} />
        </section>
      </div>
    </>
  );
}
