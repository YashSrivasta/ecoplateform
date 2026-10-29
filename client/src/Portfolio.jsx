import { Icon, Proof, fmtDate } from './ui';
import { BarChart } from './charts';
import './profile.css';

const n = v => Number(v) || 0;

/** Read-only portfolio. Used on the student's Profile page and (Stage 7) when a teacher opens a student. p = response of /student/portfolio. */
export default function PortfolioView({ p }) {
  const acc = p.quiz?.accuracy;
  return (
    <div>
      <div className="pf-tiles">
        <div className="tile"><span className="label">Total points</span><div className="big">{n(p.points)}</div></div>
        <div className="tile"><span className="label">Level</span><div className="big">{n(p.level)}</div></div>
        <div className="tile"><span className="label">Streak</span><div className="big">{n(p.streak?.current)}<span className="unit">days</span></div><span className="label">Best: {n(p.streak?.best)}</span></div>
        <div className="tile"><span className="label">Quiz accuracy</span><div className="big">{acc == null ? '–' : n(acc)}{acc != null && <span className="unit">%</span>}</div><span className="label">{n(p.quiz?.attempts)} answered</span></div>
        <div className="tile"><span className="label">Daily challenges</span><div className="big">{n(p.daily_challenges)}</div></div>
      </div>

      <div className="pf-sec">
        <h3>Subjects</h3>
        <p className="muted">Quiz accuracy in each subject</p>
        <BarChart label="Quiz accuracy by subject" unit="%" max={100} rows={p.subjects.map(s => ({ label: `${s.icon} ${s.name}`, value: s.accuracy == null ? 0 : n(s.accuracy), color: s.color }))} />
        <details className="table-view"><summary>View as table</summary>
          <div className="scroll"><table><thead><tr><th>Subject</th><th className="num">Points</th><th className="num">Answered</th><th className="num">Accuracy</th></tr></thead>
            <tbody>{p.subjects.map(s => <tr key={s.slug}><td>{s.name}</td><td className="num">{n(s.points)}</td><td className="num">{n(s.attempts)}</td><td className="num">{s.accuracy == null ? 'No quizzes yet' : n(s.accuracy) + '%'}</td></tr>)}</tbody></table></div>
        </details>
      </div>

      <div className="pf-sec">
        <h3>Badges earned</h3>
        {p.badges.length ? <div className="badges">{p.badges.map(b => <div key={b.name} className="badge on"><span className="em" aria-hidden="true">{b.icon}</span>{b.name}<small>{b.at} pts</small></div>)}</div> : <p className="muted">No badges yet. The first one comes at 10 points.</p>}
      </div>

      <div className="pf-sec">
        <h3>Approved missions</h3>
        {p.missions.length ? (
          <div className="pf-missions">
            {p.missions.map((m, i) => (
              <div className="pf-mission" key={i}>
                <Proof src={m.photo} name={p.student.name} />
                <b>{m.title}</b>
                <div className="chips">
                  <span className="chip lime"><Icon name="check" size={12} />+{n(m.awarded)} pts</span>
                  {(m.subjects || []).map(s => <span key={s.slug} className="chip" style={{ background: s.color, color: '#10140a' }}><span aria-hidden="true">{s.icon}</span>{s.name}</span>)}
                </div>
                {m.reviewed_at && <span className="label">Approved {fmtDate(m.reviewed_at)}</span>}
              </div>
            ))}
          </div>
        ) : <p className="muted">No approved missions yet.</p>}
      </div>

      {p.projects?.length > 0 && (
        <div className="pf-sec"><h3>Projects</h3><div className="chips">{p.projects.map(x => <span className="chip" key={x.id}><Icon name="folder" size={14} />{x.title}</span>)}</div></div>
      )}
    </div>
  );
}
