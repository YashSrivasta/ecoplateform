import { useEffect, useState } from 'react';
import { api } from './api';
import { useToast } from './ui';

/** "Ask your teacher" doubts panel (same behaviour as before, now its own file so other pages can reuse it). */
export default function AskTeacher({ classes }) {
  const [mine, setMine] = useState([]);
  const [dm, setDm] = useState({ class_id: classes[0]?.id || '', message: '' });
  const [err, setErr] = useState('');
  const toast = useToast();
  const load = () => api('/doubts').then(setMine).catch(() => {});
  useEffect(() => { load(); }, []);
  const ask = async () => {
    setErr('');
    try { await api('/doubts', { method: 'POST', body: dm }); setDm({ ...dm, message: '' }); toast('Sent to your teacher'); load(); } catch (e) { setErr(e.message); }
  };
  return (
    <aside className="card paper ask" aria-label="Ask your teacher">
      <h3>Ask your teacher</h3>
      <select aria-label="Class" value={dm.class_id} onChange={e => setDm({ ...dm, class_id: e.target.value })}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <textarea rows={3} aria-label="Your doubt" placeholder="Describe your doubt" value={dm.message} onChange={e => setDm({ ...dm, message: e.target.value })} />
      {err && <p className="alert" role="alert">{err}</p>}
      <button className="btn btn-primary" onClick={ask} disabled={!dm.message.trim()}>Send</button>
      {mine.length > 0 && <div className="thread">
        {mine.map((m, i) => <div key={i} className="stack" style={{ gap: '.4rem' }}>
          <div className="bubble you"><small>You</small>{m.message}</div>
          {m.reply ? <div className="bubble teacher"><small>Teacher</small>{m.reply}</div> : <span className="chip warn" style={{ alignSelf: 'flex-start' }}>Waiting for reply</span>}
        </div>)}
      </div>}
    </aside>
  );
}
