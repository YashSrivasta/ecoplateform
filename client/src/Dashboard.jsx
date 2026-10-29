import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import { Avatar, Icon, Loading, PointsChart } from './ui';
import { ActivityList, Join } from './StudentShared';
import Daily from './Daily';
import Impact from './Impact';
import './dashboard.css';

const GO = { quiz: '/student/quizzes', mission: '/student/tasks' };

function Streak({ s }) {
  const days = s?.current || 0;
  return (
    <section className={'card stat streak' + (days ? ' hot' : '')} aria-label="Daily streak">
      <span className="flame"><Icon name="flame" size={28} /></span>
      <div>
        <span className="label">Daily streak</span>
        <div className="big">{days}<span className="unit">{days === 1 ? 'day' : 'days'}</span></div>
        <span className="label">Best: {s?.best || 0} {(s?.best || 0) === 1 ? 'day' : 'days'}</span>
        <div className="streak-state">{s?.playedToday ? <><Icon name="check" size={16} />Done for today</> : <><Icon name="alert" size={16} />Play today to keep it going</>}</div>
      </div>
    </section>
  );
}

function NextBadge({ badges, points }) {
  const next = badges.find(b => !b.earned);
  if (!next) return <section className="card stat"><span className="label">Badges</span><div className="big">All<span className="unit">unlocked</span></div><p className="muted">You have every badge. Amazing!</p></section>;
  const prev = [...badges].reverse().find(b => b.earned)?.at || 0;
  const pct = Math.max(0, Math.min(100, ((points - prev) / (next.at - prev)) * 100));
  return (
    <section className="card stat next-badge" aria-label="Next badge">
      <span className="em" aria-hidden="true">{next.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="label">Next badge</span>
        <h3>{next.name}</h3>
        <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100" aria-label={`Progress to ${next.name}`}><i style={{ width: pct + '%' }} /></div>
        <span className="label">{next.at - points} more points</span>
      </div>
    </section>
  );
}

function Suggestions({ items }) {
  if (!items.length) return null;
  return (
    <section className="card">
      <h2>Suggested for you</h2><p className="muted">Based on what you have done so far</p>
      <div style={{ marginTop: 6 }}>
        {items.map((s, i) => (
          <div className="suggest" key={i}>
            <div className="txt"><b>{s.title}</b><span className="muted">{s.text}</span></div>
            {s.action?.type === 'join' ? <a className="btn btn-line" href="#join">Join a class</a>
              : s.action?.type === 'daily' ? <a className="btn btn-line" href="#daily">Play now</a>
              : GO[s.action?.type] && <Link className="btn btn-line" to={GO[s.action.type]}>Let's go</Link>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SDash() {
  const [d, setD] = useState(null);
  const [sug, setSug] = useState([]);
  const [err, setErr] = useState('');
  const load = () => {
    api('/student/dashboard').then(setD).catch(e => setErr(e.message));
    api('/student/suggestions').then(setSug).catch(() => setSug([])); // optional: a failure here must not break the page
  };
  useEffect(() => { load(); }, []);
  if (err) return <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>;
  if (!d) return <Loading />;
  const earned = d.badges.filter(b => b.earned).length;
  return (
    <>
      <header className="page-head">
        <div><h1>Hi, {d.user.name.split(' ')[0]}</h1><p className="muted">Here is how your learning is going.</p></div>
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
      <div className="cards-3"><Streak s={d.streak} /><NextBadge badges={d.badges} points={d.points} /></div>
      {!d.classes.length && <div id="join"><Join onDone={load} /></div>}
      {d.classes.length > 0 && <Daily onChange={load} />}
      <Suggestions items={sug} />
      <div className="grid-2">
        <section className="card"><h2>Progress</h2><p className="muted">Points earned per day</p><div style={{ marginTop: 14 }}><PointsChart data={d.chart} /></div></section>
        <section className="card"><h2>Badges</h2><p className="muted">{earned} of {d.badges.length} unlocked</p>
          <div className="badges">{d.badges.map(b => <div key={b.name} className={'badge ' + (b.earned ? 'on' : 'off')}><span className="em" aria-hidden="true">{b.icon}</span>{b.name}<small>{b.at} pts · {b.earned ? 'Unlocked' : 'Locked'}</small></div>)}</div>
        </section>
      </div>
      <Impact key={d.points} />
      <section className="card paper"><h2>Recent activity</h2><p className="muted" style={{ marginBottom: 8 }}>Your latest points</p><ActivityList items={d.activity} /></section>
    </>
  );
}
export default SDash;
