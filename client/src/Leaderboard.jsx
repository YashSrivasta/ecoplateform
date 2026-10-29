import { useEffect, useState } from 'react';
import { api } from './api';
import { Avatar, Icon, Loading } from './ui';
import './leaderboard.css';

const SORTS = [['points', 'Points'], ['streak', 'Streak'], ['accuracy', 'Accuracy']];
const MEDAL = { 1: ['🥇', 'Gold'], 2: ['🥈', 'Silver'], 3: ['🥉', 'Bronze'] };
const n = v => Number(v) || 0;

function main(r, sort) {
  if (sort === 'streak') return [n(r.streak), n(r.streak) === 1 ? 'day' : 'days'];
  if (sort === 'accuracy') return [r.accuracy == null ? '–' : n(r.accuracy) + '%', ''];
  return [n(r.points), 'pts'];
}
function detail(r, sort) {
  const bits = [];
  if (sort !== 'points') bits.push(`${n(r.points)} pts`);
  if (sort !== 'streak') bits.push(`${n(r.streak)}-day streak`);
  if (sort !== 'accuracy') bits.push(r.accuracy == null ? 'no quizzes yet' : `${n(r.accuracy)}% accuracy`);
  else bits.push(`${n(r.attempts)} ${n(r.attempts) === 1 ? 'question' : 'questions'} answered`);
  return bits.join(' · ');
}

export default function Leaderboard() {
  const [sort, setSort] = useState('points');
  const [subject, setSubject] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/subjects').then(setSubjects).catch(() => {}); }, []);
  useEffect(() => {
    setD(null); setErr('');
    api(`/leaderboard?sort=${sort}&limit=50${subject ? '&subject=' + subject : ''}`).then(setD).catch(e => { setErr(e.status === 403 ? 'Join a class to see the leaderboard.' : e.message); setD({ rows: [], total: 0 }); });
  }, [sort, subject]);
  const me = d?.rows.find(r => r.me);
  const subj = subjects.find(s => s.slug === subject);
  return (
    <>
      <header className="page-head"><div><h1>Leaderboard</h1><p className="muted">See how you and your classmates are doing{subj ? ` in ${subj.name}` : ''}. Only people in your class appear here.</p></div></header>
      <section className="card">
        <div className="lb-controls">
          <div className="seg" role="group" aria-label="Rank by">
            {SORTS.map(([k, label]) => <button type="button" key={k} className={sort === k ? 'on' : ''} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
          </div>
          <div className="filters">
            <label className="label" htmlFor="lb-subject">Subject</label>
            <select id="lb-subject" value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">All subjects</option>
              {subjects.map(s => <option key={s.slug} value={s.slug}>{s.icon} {s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="lb-sum" style={{ margin: '1rem 0 .25rem' }} role="status" aria-live="polite">
          {d && me && <span className="chip lime"><Icon name="trophy" size={14} />You are #{me.rank} of {d.total}</span>}
          {d && !me && d.total > 0 && <span className="chip">{d.total} students</span>}
        </div>
        {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
        {!d && <Loading />}
        {d && !d.rows.length && !err && <p className="muted">Nobody has any activity here yet.</p>}
        {d?.rows.length > 0 && (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label={`Ranking by ${SORTS.find(s => s[0] === sort)[1].toLowerCase()}`}>
            {d.rows.map((r, i) => {
              const [val, unit] = main(r, sort), medal = MEDAL[r.rank];
              return (
                <li key={i} className={'lb-row' + (r.me ? ' me' : '')}>
                  <div className="lb-rank"><span className="sr-only">Rank </span>{r.rank}{medal && <span className="medal" aria-hidden="true" title={medal[1]}>{medal[0]}</span>}</div>
                  <div className="lb-who">
                    <Avatar u={r} />
                    <div style={{ minWidth: 0 }}><b>{r.name}{r.me && <span className="chip lime" style={{ marginLeft: '.5rem' }}>You</span>}</b><small>{detail(r, sort)}</small></div>
                  </div>
                  <div className="lb-main">{val}<small>{unit}</small></div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
