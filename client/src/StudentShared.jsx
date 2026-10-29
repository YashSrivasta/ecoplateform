import { useState } from 'react';
import { api } from './api';
import { Icon, fmtDate, useToast } from './ui';

export function Join({ onDone }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const toast = useToast();
  const go = async e => {
    e.preventDefault(); setErr('');
    try { const r = await api('/classes/join', { method: 'POST', body: { code } }); toast('Joined ' + r.class); onDone(); } catch (x) { setErr(x.message); }
  };
  return (
    <form className="card paper" onSubmit={go}>
      <h3>Join a class</h3>
      <p className="muted">Ask your teacher for the class code. You need a class to take quizzes and upload missions.</p>
      <div className="row">
        <input aria-label="Class code" placeholder="Class code" value={code} onChange={e => setCode(e.target.value)} required />
        <button className="btn btn-primary">Join class</button>
      </div>
      {err && <p className="alert" style={{ marginTop: 12 }}>{err}</p>}
    </form>
  );
}

export function ActivityList({ items }) {
  if (!items.length) return <p className="muted">No activity yet. Try a quiz or a mission.</p>;
  return items.map((a, i) => (
    <div className="act" key={i}>
      <span className="ico"><Icon name="check" size={18} /></span>
      <div className="txt"><b>{a.text}</b><span className="muted">{fmtDate(a.created_at)}</span></div>
      <span className="pts">+{a.points}</span>
    </div>
  ));
}
