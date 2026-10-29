import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Icon, Loading, fmtDate, useToast } from './ui';
import { Join } from './StudentShared';
import './missions.css';

const MAX = 5 * 1024 * 1024;

function when(m) {
  if (!m.deadline) return null;
  const end = new Date(m.deadline), left = Math.ceil((end - Date.now()) / 86400000);
  if (m.closed || left < 0) return { text: `Closed (was due ${fmtDate(m.deadline)})`, warn: true };
  if (left === 0) return { text: 'Due today', warn: true };
  if (left === 1) return { text: 'Due tomorrow', warn: true };
  return { text: `Due ${fmtDate(m.deadline)} (${left} days left)` };
}

function Mission({ m, onSent }) {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const input = useRef(null);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);

  const clear = () => { setFile(null); setUrl(null); if (input.current) input.current.value = ''; };
  const pick = e => {
    const f = e.target.files[0]; setErr('');
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Please choose a photo (an image file).'); clear(); return; }
    if (f.size > MAX) { setErr('That photo is bigger than 5 MB. Please choose a smaller one.'); clear(); return; }
    setFile(f); setUrl(URL.createObjectURL(f));
  };
  const send = async () => {
    setBusy(true); setErr('');
    const form = new FormData(); form.append('photo', file);
    try { await api(`/missions/${m.id}/submit`, { method: 'POST', form }); toast('Photo sent to your teacher for review.'); clear(); onSent(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const d = when(m);
  const canUpload = !m.closed && (!m.status || m.status === 'rejected');
  return (
    <article className="card mission">
      <div className="mission-main">
        <div className="mission-top"><h3>{m.title}</h3></div>
        {m.description && <p className="muted">{m.description}</p>}
        <div className="chips">
          <span className="chip">{m.class_name}</span>
          <span className="chip">{m.points} points{m.subjects?.length > 1 ? `, shared across ${m.subjects.length} subjects` : ''}</span>
          {m.project && <span className="chip"><Icon name="folder" size={14} />Project: {m.project}</span>}
          {(m.subjects || []).map(s => <span key={s.slug} className="chip subj" style={{ background: s.color, color: '#10140a' }}><span aria-hidden="true">{s.icon}</span>{s.name}</span>)}
        </div>
        {d && <p className={'deadline' + (d.warn ? ' ' : ' muted')} style={d.warn ? { color: 'var(--warn-fg)' } : undefined}><Icon name={d.warn ? 'alert' : 'tasks'} size={16} />{d.text}</p>}
      </div>
      <div className="mission-side">
        {m.status === 'pending' && <span className="chip warn">Waiting for review</span>}
        {m.status === 'approved' && <span className="chip lime"><Icon name="check" size={14} />Approved +{m.awarded}</span>}
        {m.status === 'rejected' && <span className="chip danger">Rejected, try again</span>}
        {canUpload && !file && <label className="btn btn-primary"><Icon name="upload" size={18} />{m.status === 'rejected' ? 'Choose a new photo' : 'Choose photo'}<input ref={input} className="file-input" type="file" accept="image/*" onChange={pick} /></label>}
        {m.closed && !m.status && <span className="chip danger">Deadline passed</span>}
      </div>
      {file && (
        <div className="preview">
          <img src={url} alt={`Preview of your photo for ${m.title}`} />
          <div className="txt"><b>{file.name}</b><span className="muted">Check that your photo shows the work clearly, then send it.</span></div>
          <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send to teacher'}</button>
          <button type="button" className="btn btn-line" onClick={clear} disabled={busy}>Choose a different photo</button>
        </div>
      )}
      {err && <p className="alert" role="alert" style={{ width: '100%' }}><Icon name="alert" size={18} /> {err}</p>}
    </article>
  );
}

export default function Missions() {
  const [ms, setMs] = useState(null);
  const [err, setErr] = useState('');
  const [classes, setClasses] = useState(null);
  const toast = useToast();
  const load = () => api('/missions').then(m => {
    setMs(m);
    let seen = []; try { seen = JSON.parse(localStorage.getItem('seen') || '[]'); } catch {}
    const fresh = m.filter(x => x.status === 'approved' && !seen.includes(x.id));
    if (fresh.length) { toast(fresh.length === 1 ? `Work accepted: ${fresh[0].title} (+${fresh[0].awarded} points)` : `${fresh.length} missions accepted: +${fresh.reduce((a, x) => a + (+x.awarded || 0), 0)} points`, 6000); try { localStorage.setItem('seen', JSON.stringify([...seen, ...fresh.map(x => x.id)])); } catch {} }
  }).catch(e => { setErr(e.message); setMs([]); });
  const init = () => api('/student/dashboard').then(d => { setClasses(d.classes); if (d.classes.length) load(); }).catch(e => setErr(e.message));
  useEffect(() => { init(); }, []);
  const list = [...(ms || [])].sort((a, b) => !!a.closed - !!b.closed), todo = (ms || []).filter(m => (!m.status || m.status === 'rejected') && !m.closed).length;
  return (
    <>
      <header className="page-head"><div><h1>Tasks</h1><p className="muted">Complete the mission, then upload a photo as proof. Points arrive after your teacher approves.</p></div>
        {ms && classes?.length > 0 && <span className="chip lime">{todo} to do</span>}</header>
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {!classes && !err && <Loading />}
      {classes && !classes.length && <Join onDone={init} />}
      {classes?.length > 0 && ms && !ms.length && !err && <p className="muted">No missions yet. Your teacher will post some soon.</p>}
      <div className="stack">{list.map(m => <Mission key={m.id} m={m} onSent={load} />)}</div>
    </>
  );
}
