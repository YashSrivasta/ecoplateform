import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon, Loading, useToast } from './ui';

/** Student doubts for one class, with a reply box for the class creator. Same behaviour as before, now in its own file. */
export default function Doubts({ classId, owner }) {
  const toast = useToast();
  const [list, setList] = useState(null), [rep, setRep] = useState({}), [err, setErr] = useState('');
  const load = () => classId && api(`/classes/${classId}/doubts`).then(setList).catch(() => setList([]));
  useEffect(() => { setList(null); load(); }, [classId]);
  const reply = async d => {
    try { await api(`/doubts/${d.id}/reply`, { method: 'POST', body: { reply: rep[d.id] } }); setErr(''); toast('Reply sent'); load(); } catch (e) { setErr(e.message); }
  };
  return (
    <section aria-label="Student doubts">
      <h2 style={{ marginTop: '.875rem' }}>Student doubts</h2>
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {!list && <Loading />}
      {list?.length === 0 && <p className="muted">No doubts yet.</p>}
      <div className="stack" style={{ marginTop: '.75rem' }}>
        {(list || []).map(d => (
          <article className="card paper" key={d.id}>
            <p><b>{d.student}</b> <span className="muted">asks</span></p><p>{d.message}</p>
            {d.reply ? <p className="bubble teacher" style={{ marginTop: '.6rem' }}><small>Your reply</small>{d.reply}</p>
              : owner && <div className="row"><input aria-label={`Reply to ${d.student}`} placeholder="Write a reply" value={rep[d.id] || ''} onChange={e => setRep({ ...rep, [d.id]: e.target.value })} /><button className="btn btn-primary" onClick={() => reply(d)} disabled={!(rep[d.id] || '').trim()}>Reply</button></div>}
          </article>
        ))}
      </div>
    </section>
  );
}
