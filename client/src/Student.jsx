import { useEffect, useState } from 'react';
import { api } from './api';
import { Avatar, Icon, PointsChart, fmtDate, useToast } from './ui';

function Join({ onDone }) {
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

function ActivityList({ items }) {
  if (!items.length) return <p className="muted">No activity yet. Try a quiz or a mission.</p>;
  return items.map((a, i) => (
    <div className="act" key={i}>
      <span className="ico"><Icon name="check" size={18} /></span>
      <div className="txt"><b>{a.text}</b><span className="muted">{fmtDate(a.created_at)}</span></div>
      <span className="pts">+{a.points}</span>
    </div>
  ));
}

export function SDash() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/student/dashboard').then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (err) return <p className="alert">{err}</p>;
  if (!d) return <p className="muted">Loading…</p>;
  const earned = d.badges.filter(b => b.earned).length;
  return (
    <>
      <header className="page-head">
        <div><h1>Hi, {d.user.name.split(' ')[0]}</h1><p className="muted">Here is how your planet-saving is going.</p></div>
        <div className="chips" style={{ margin: 0 }}>{d.classes.map(c => <span className="chip" key={c.id}>{c.name}</span>)}</div>
      </header>
      <section className="card hero-card">
        <Avatar u={d.user} lg />
        <div className="who"><h2>{d.user.name}</h2><p className="muted">Class {d.user.grade}</p></div>
        <div className="stat"><span className="label">Total points</span><div className="big">{d.points}<span className="unit">pts</span></div></div>
        <div className="level">
          <div className="between row" style={{ margin: 0 }}><span className="label">Level {d.level}</span><span className="label">{d.levelProgress} / 100</span></div>
          <div className="bar" role="progressbar" aria-valuenow={d.levelProgress} aria-valuemin="0" aria-valuemax="100" aria-label="Progress to next level"><i style={{ width: d.levelProgress + '%' }} /></div>
          <span className="label">{100 - d.levelProgress} points to level {d.level + 1}</span>
        </div>
      </section>
      {!d.classes.length && <Join onDone={load} />}
      <div className="grid-2">
        <section className="card"><h2>Progress</h2><p className="muted">Points earned per day</p><div style={{ marginTop: 14 }}><PointsChart data={d.chart} /></div></section>
        <section className="card"><h2>Badges</h2><p className="muted">{earned} of {d.badges.length} unlocked</p>
          <div className="badges">{d.badges.map(b => <div key={b.name} className={'badge ' + (b.earned ? 'on' : 'off')}><span className="em">{b.icon}</span>{b.name}<small>{b.at} pts</small></div>)}</div>
        </section>
      </div>
      <section className="card paper"><h2>Daily activity</h2><p className="muted" style={{ marginBottom: 8 }}>Your latest points</p><ActivityList items={d.activity} /></section>
    </>
  );
}

export function Quizzes() {
  const [qs, setQs] = useState([]);
  const [res, setRes] = useState({});
  const [err, setErr] = useState('');
  const [classes, setClasses] = useState(null);
  const [mine, setMine] = useState([]);
  const [dm, setDm] = useState({ class_id: '', message: '' });
  const toast = useToast();
  const loadDoubts = () => api('/doubts').then(setMine).catch(() => {});
  const init = () => api('/student/dashboard').then(d => {
    setClasses(d.classes); setDm(x => ({ ...x, class_id: x.class_id || d.classes[0]?.id || '' }));
    if (d.classes.length) { api('/quizzes').then(setQs).catch(e => setErr(e.message)); loadDoubts(); }
  }).catch(e => setErr(e.message));
  useEffect(() => { init(); }, []);
  const answer = async (q, choice) => { try { const r = await api(`/quizzes/${q.id}/answer`, { method: 'POST', body: { choice } }); setRes(s => ({ ...s, [q.id]: { ...r, choice } })); } catch (e) { setErr(e.message); } };
  const ask = async () => { try { await api('/doubts', { method: 'POST', body: dm }); setDm({ ...dm, message: '' }); toast('Sent to your teacher'); loadDoubts(); } catch (e) { setErr(e.message); } };
  return (
    <div className="with-ask">
      <header className="page-head"><div><h1>Quiz Hub</h1><p className="muted">Questions for your class level. Harder questions are worth more points.</p></div></header>
      {err && <p className="alert">{err}</p>}
      {classes && !classes.length && <Join onDone={init} />}
      {classes && classes.length > 0 && qs.length === 0 && !err && <p className="muted">No quizzes for your class level yet.</p>}
      <div className="stack">
        {qs.map(q => {
          const r = res[q.id], done = !!r || q.correct != null;
          return (
            <article className="card" key={q.id}>
              <div className="quiz-top">
                <span className="dots" role="img" aria-label={`Difficulty ${q.difficulty} of 5`}>{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= q.difficulty ? 'on' : ''} />)}</span>
                <span className="chip">Worth {q.difficulty * 5} points</span>
              </div>
              <h3 className="quiz-q">{q.question}</h3>
              {q.options.map((o, i) => {
                let cls = 'opt';
                if (r) cls += i === r.answer ? ' right' : i === r.choice ? ' wrong' : ' dim'; else if (done) cls += ' dim';
                return <button key={i} className={cls} disabled={done} onClick={() => answer(q, i)}>{o}{r && i === r.answer && <Icon name="check" size={18} />}</button>;
              })}
              <div className="quiz-result">
                {r && (r.correct ? <span className="chip lime">Correct! +{r.points} points</span> : <span className="chip danger">Not quite. The right answer is highlighted.</span>)}
                {!r && q.correct != null && <span className="chip">{Number(q.correct) === 1 ? 'Answered correctly' : 'Already answered'}</span>}
              </div>
            </article>
          );
        })}
      </div>
      {classes && classes.length > 0 && (
        <aside className="card paper ask" aria-label="Ask your teacher">
          <h3>Ask your teacher</h3>
          <select aria-label="Class" value={dm.class_id} onChange={e => setDm({ ...dm, class_id: e.target.value })}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <textarea rows={3} aria-label="Your doubt" placeholder="Describe your doubt" value={dm.message} onChange={e => setDm({ ...dm, message: e.target.value })} />
          <button className="btn btn-primary" onClick={ask} disabled={!dm.message.trim()}>Send</button>
          {mine.length > 0 && <div className="thread">
            {mine.map((m, i) => <div key={i} className="stack" style={{ gap: 6 }}>
              <div className="bubble you"><small>You</small>{m.message}</div>
              {m.reply ? <div className="bubble teacher"><small>Teacher</small>{m.reply}</div> : <span className="chip warn" style={{ alignSelf: 'flex-start' }}>Waiting for reply</span>}
            </div>)}
          </div>}
        </aside>
      )}
    </div>
  );
}

export function Tasks() {
  const [ms, setMs] = useState([]);
  const [err, setErr] = useState('');
  const [classes, setClasses] = useState(null);
  const toast = useToast();
  const load = () => api('/missions').then(m => {
    setMs(m);
    let seen = []; try { seen = JSON.parse(localStorage.getItem('seen') || '[]'); } catch {}
    const fresh = m.filter(x => x.status === 'approved' && !seen.includes(x.id));
    if (fresh.length) { toast('Work accepted successfully.'); try { localStorage.setItem('seen', JSON.stringify([...seen, ...fresh.map(x => x.id)])); } catch {} }
  }).catch(e => setErr(e.message));
  const init = () => api('/student/dashboard').then(d => { setClasses(d.classes); if (d.classes.length) load(); }).catch(e => setErr(e.message));
  useEffect(() => { init(); }, []);
  const up = async (m, input) => {
    const file = input.files[0]; if (!file) return;
    const form = new FormData(); form.append('photo', file);
    try { await api(`/missions/${m.id}/submit`, { method: 'POST', form }); setErr(''); toast('Photo sent to your teacher for review.'); load(); } catch (e) { setErr(e.message); }
    input.value = '';
  };
  return (
    <>
      <header className="page-head"><div><h1>Tasks</h1><p className="muted">Complete the mission, then upload a photo as proof. Points arrive after your teacher approves.</p></div></header>
      {err && <p className="alert">{err}</p>}
      {classes && !classes.length && <Join onDone={init} />}
      {classes && classes.length > 0 && ms.length === 0 && !err && <p className="muted">No missions yet. Your teacher will post some soon.</p>}
      <div className="stack">
        {ms.map(m => (
          <article className="card mission" key={m.id}>
            <div className="mission-main">
              <h3>{m.title}</h3>
              {m.description && <p className="muted">{m.description}</p>}
              <div className="chips"><span className="chip">{m.class_name}</span><span className="chip">{m.points} points</span></div>
            </div>
            <div className="mission-side">
              {m.status === 'pending' && <span className="chip warn">Waiting for review</span>}
              {m.status === 'approved' && <span className="chip lime">Approved +{m.awarded}</span>}
              {m.status === 'rejected' && <span className="chip danger">Rejected, try again</span>}
              {(!m.status || m.status === 'rejected') && <label className="btn btn-primary"><Icon name="upload" size={18} />Upload photo<input className="file-input" type="file" accept="image/*" onChange={e => up(m, e.target)} /></label>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export function Profile() {
  const [d, setD] = useState(null);
  const [qs, setQs] = useState([]);
  const [err, setErr] = useState('');
  const toast = useToast();
  const load = () => api('/student/dashboard').then(x => { setD(x); if (x.classes.length) api('/quizzes').then(setQs).catch(() => {}); }).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const up = async input => {
    const f = input.files[0]; if (!f) return;
    const form = new FormData(); form.append('photo', f);
    try { await api('/me/photo', { method: 'POST', form }); toast('Photo updated'); load(); } catch (e) { setErr(e.message); }
    input.value = '';
  };
  if (err && !d) return <p className="alert">{err}</p>;
  if (!d) return <p className="muted">Loading…</p>;
  const tried = qs.filter(q => q.correct != null).length;
  const right = qs.filter(q => Number(q.correct) === 1).length;
  const pct = tried ? Math.round((right / tried) * 100) : 0;
  const next = d.badges.find(b => !b.earned);
  return (
    <>
      {err && <p className="alert">{err}</p>}
      <div className="profile-grid">
        <section className="card">
          <Avatar u={d.user} lg />
          <h1>{d.user.name}</h1>
          <p className="muted">{d.user.email}</p>
          <p>Class {d.user.grade} · {d.points} points</p>
          <label className="btn btn-line" style={{ marginTop: 10 }}>Change photo<input className="file-input" type="file" accept="image/*" onChange={e => up(e.target)} /></label>
          <h3 style={{ marginTop: 26 }}>My classes</h3>
          {d.classes.length ? d.classes.map(c => <p key={c.id}>{c.name} <span className="muted">· teacher {c.teacher}</span></p>) : <p className="muted">Not in a class yet. Join one from the Dashboard.</p>}
        </section>
        <section className="card">
          <h2>Progress</h2>
          <p className="muted">Total points: {d.points}</p>
          <div style={{ marginTop: 12 }}><PointsChart data={d.chart} /></div>
          <div className="tiles">
            <div className="tile"><span className="label">Total points</span><div className="big">{d.points}</div></div>
            <div className="tile"><span className="label">Quizzes attempted</span><div className="big">{tried}</div></div>
            <div className="tile"><span className="label">Correct answers</span><div className="big">{pct}<span className="unit">%</span></div></div>
            <div className="tile"><span className="label">Classes joined</span><div className="big">{d.classes.length}</div></div>
          </div>
          <div className="milestone"><span className="label">Next milestone</span>
            <p>{next ? `Earn ${next.at - d.points} more points to unlock the ${next.name} badge.` : 'You have unlocked every badge. Keep going!'}</p></div>
          <h2>Daily activity</h2><div style={{ marginTop: 6 }}><ActivityList items={d.activity} /></div>
        </section>
      </div>
    </>
  );
}
