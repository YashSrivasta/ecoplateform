import { useEffect, useState } from 'react';
import { api } from './api';
import { fmtDay } from './ui';
import { BarChart } from './charts';
import './teamchallenge.css';

const STATUS = { upcoming: 'Starts soon', active: 'Running now', ended: 'Finished' };

/** Student dashboard card: the team challenges the student is in. Hidden when there is none. */
export default function StudentChallenges() {
  const [list, setList] = useState([]);
  useEffect(() => { api('/student/challenges').then(setList).catch(() => setList([])); }, []);
  if (!list.length) return null;
  return (
    <>
      {list.slice(0, 2).map(c => {
        const mine = c.teams.find(t => t.id === c.my_team_id);
        return (
          <section className="card" key={c.id}>
            <div className="between row" style={{ margin: 0 }}>
              <div><h2>{c.title}</h2><p className="muted">Team challenge in {c.class_name} · {fmtDay(c.starts_on)} to {fmtDay(c.ends_on)}</p></div>
              <span className={'chip' + (c.status === 'active' ? ' lime' : '')}>{STATUS[c.status]}</span>
            </div>
            {mine && (
              <p className="tc-me" style={{ marginTop: '.9rem' }}>
                You are on <b>{mine.name}</b>{c.mates.length > 0 && <> with {c.mates.join(', ')}</>}.
                {c.status === 'active' && <> Your team is in place <b>{mine.rank}</b> of {c.teams.length}.</>}
                {c.status === 'upcoming' && <> Points count from {fmtDay(c.starts_on)}.</>}
              </p>
            )}
            {c.status === 'ended' && c.winner && (
              <p className="tc-me" style={{ marginTop: '.6rem' }} role="status">
                {c.winner.includes(mine?.name) ? 'Your team won! 🏆' : <>Winner: <b>{c.winner.join(' and ')}</b>. Great effort!</>}
              </p>
            )}
            {c.status !== 'upcoming' && (
              <>
                <h3 className="tc-sub">Average points per student</h3>
                <BarChart label={`Standings for ${c.title}`} unit=" pts" rows={c.teams.map(t => ({ label: `#${t.rank} ${t.name}${t.id === c.my_team_id ? ' (you)' : ''}`, value: t.average, color: t.color }))} />
                <p className="muted" style={{ marginTop: '.5rem' }}>Quizzes, daily challenges and missions all count. Teams are ranked by average so a bigger team has no advantage.</p>
              </>
            )}
          </section>
        );
      })}
    </>
  );
}
