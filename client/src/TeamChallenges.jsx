import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { Icon, Loading, Pick, fmtDay, useToast } from './ui';
import { BarChart } from './charts';
import './teamchallenge.css';

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const STATUS = { upcoming: 'Starts soon', active: 'Running now', ended: 'Finished' };

export default function TeamChallenges() {
  const ctx = useOutletContext(), toast = useToast();
  const [list, setList] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: '', starts_on: plus(0), ends_on: plus(6), teams: 2 });
  const owner = ctx.cls?.owner;
  const load = () => ctx.classId && api(`/classes/${ctx.classId}/challenges`).then(setList).catch(e => { setErr(e.message); setList([]); });
  useEffect(() => { setList(null); setErr(''); load(); }, [ctx.classId]);

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api(`/classes/${ctx.classId}/challenges`, { method: 'POST', body: { ...f, teams: +f.teams } }); setF({ ...f, title: '' }); toast('Challenge started. Students are in their teams.'); load(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const remove = async c => {
    if (!window.confirm(`Delete "${c.title}"? The teams and standings will be removed. Students keep all the points they earned.`)) return;
    try { await api(`/classes/${ctx.classId}/challenges/${c.id}`, { method: 'DELETE' }); toast('Challenge deleted'); load(); } catch (x) { setErr(x.message); }
  };

  return (
    <>
      <header className="page-head"><div><h1>Team challenges</h1><p className="muted">Split a class into teams for a few days. Teams earn points by doing quizzes and missions, and the team with the best average per student wins.</p></div></header>
      <Pick ctx={ctx} />
      {ctx.cls && !owner && <p className="chip warn" style={{ alignSelf: 'flex-start' }}>You can view this class, but only {ctx.cls.creator} can start or delete challenges.</p>}
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {ctx.classId && owner && (
        <form className="card paper" onSubmit={submit}>
          <h2>New challenge</h2><p className="muted">For {ctx.cls.name} ({ctx.cls.students} students). Students are placed in random teams of about the same size when you start it.</p>
          <div className="stack" style={{ gap: '.75rem', marginTop: '.75rem' }}>
            <label className="field"><span className="label">Title</span>
              <input required minLength={3} maxLength={80} placeholder="For example: Green Week" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
            <div className="tc-row">
              <label className="field"><span className="label">Starts on</span>
                <input type="date" required min={plus(0)} value={f.starts_on} onChange={e => setF({ ...f, starts_on: e.target.value })} /></label>
              <label className="field"><span className="label">Ends on (included)</span>
                <input type="date" required min={f.starts_on} value={f.ends_on} onChange={e => setF({ ...f, ends_on: e.target.value })} /></label>
              <label className="field"><span className="label">Number of teams</span>
                <select value={f.teams} onChange={e => setF({ ...f, teams: e.target.value })}>{[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} teams</option>)}</select></label>
            </div>
            <p className="muted">Each team needs at least 2 students. Only points earned between the two dates count.</p>
          </div>
          <div className="row"><button className="btn btn-primary" disabled={busy}><Icon name="plus" size={18} />Start challenge</button></div>
        </form>
      )}
      <h2 style={{ marginTop: '.5rem' }}>Challenges for this class</h2>
      {ctx.classId && !list && <Loading />}
      {list && !list.length && !err && <p className="muted">No challenges yet.</p>}
      <div className="stack">
        {(list || []).map(c => (
          <article className="card" key={c.id}>
            <div className="between row" style={{ margin: 0 }}>
              <div><h3 className="tc-title">{c.title}</h3><p className="muted">{fmtDay(c.starts_on)} to {fmtDay(c.ends_on)}</p></div>
              <span className={'chip' + (c.status === 'active' ? ' lime' : '')}>{STATUS[c.status]}</span>
            </div>
            {c.winner && <p className="tc-me" role="status">Winner: <b>{c.winner.join(' and ')}</b> 🏆</p>}
            <h4 className="tc-sub">Average points per student</h4>
            <BarChart label={`Standings for ${c.title}`} unit=" pts" rows={c.teams.map(t => ({ label: `#${t.rank} ${t.name} · ${t.members} students`, value: t.average, color: t.color }))} />
            <details className="tc-details"><summary>Teams, totals and members</summary>
              <ul className="tc-teams">
                {c.teams.map(t => (
                  <li key={t.id}><b><i className="sw" style={{ background: t.color }} aria-hidden="true" />{t.name}</b> <span className="muted">· {t.points} points in total</span>
                    <div>{t.names.join(', ') || 'No students'}</div></li>
                ))}
              </ul>
            </details>
            {owner && <div className="row"><button type="button" className="btn btn-danger" onClick={() => remove(c)}>Delete</button></div>}
          </article>
        ))}
      </div>
    </>
  );
}
