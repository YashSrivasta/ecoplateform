import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon, Loading, useToast } from './ui';
import { ReadButton } from './a11y';
import { useCelebrate } from './Celebrate';
import { Join } from './StudentShared';
import AskTeacher from './AskTeacher';
import './quiz.css';

export default function QuizHub() {
  const [classes, setClasses] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState('');      // '' = all subjects
  const [qs, setQs] = useState(null);
  const [res, setRes] = useState({});
  const [err, setErr] = useState('');
  const toast = useToast();
  const celebrate = useCelebrate();

  const init = () => {
    api('/student/dashboard').then(d => setClasses(d.classes)).catch(e => setErr(e.message));
    api('/subjects').then(setSubjects).catch(() => {});
  };
  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (!classes?.length) return;
    setQs(null); setErr('');
    api('/quizzes' + (subject ? `?subject=${subject}` : '')).then(setQs).catch(e => { setErr(e.message); setQs([]); });
  }, [classes, subject]);

  const answer = async (q, choice) => {
    try {
      const r = await api(`/quizzes/${q.id}/answer`, { method: 'POST', body: { choice } });
      setRes(s => ({ ...s, [q.id]: { ...r, choice } }));
      celebrate(r.newBadges);
    } catch (e) { if (e.status === 409) toast('You already answered this one.'); else setErr(e.message); }
  };
  const cur = subjects.find(s => s.slug === subject);

  return (
    <div className="with-ask">
      <header className="page-head"><div><h1>Quiz Hub</h1><p className="muted">Questions for your class level. Harder questions are worth more points.</p></div></header>
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {!classes && !err && <Loading />}
      {classes && !classes.length && <Join onDone={init} />}
      {classes?.length > 0 && (
        <>
          <div className="subject-filter" role="group" aria-label="Filter by subject">
            <button type="button" aria-pressed={!subject} onClick={() => setSubject('')}>All subjects</button>
            {subjects.map(s => <button type="button" key={s.slug} style={{ '--c': s.color }} aria-pressed={subject === s.slug} onClick={() => setSubject(s.slug)}><span aria-hidden="true">{s.icon}</span>{s.name}</button>)}
          </div>
          <p className="muted" role="status" aria-live="polite">{qs ? `${qs.length} question${qs.length === 1 ? '' : 's'}${cur ? ' in ' + cur.name : ''}` : 'Loading questions…'}</p>
          {qs && !qs.length && !err && <p className="muted">No quizzes {cur ? `in ${cur.name} ` : ''}for your class level yet.</p>}
          <div className="stack">
            {(qs || []).map(q => {
              const r = res[q.id], done = !!r || q.correct != null;
              return (
                <article className="card" key={q.id}>
                  <div className="quiz-top">
                    <div className="quiz-meta">
                      {q.subject_name && <span className="chip" style={{ background: q.color, color: '#10140a' }}><span aria-hidden="true">{q.icon}</span>{q.subject_name}</span>}
                      <span className="dots" role="img" aria-label={`Difficulty ${q.difficulty} of 5`}>{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= q.difficulty ? 'on' : ''} />)}</span>
                    </div>
                    <span className="chip">Worth {q.difficulty * 5} points</span>
                  </div>
                  <div className="quiz-head">
                    <h3 className="quiz-q">{q.question}</h3>
                    <ReadButton text={`${q.question}. ${q.options.map((o, i) => `Option ${i + 1}: ${o}`).join('. ')}`} label="Read the question aloud" />
                  </div>
                  {q.options.map((o, i) => {
                    let cls = 'opt';
                    if (r) cls += i === r.answer ? ' right' : i === r.choice ? ' wrong' : ' dim'; else if (done) cls += ' dim';
                    return (
                      <button key={i} type="button" className={cls} disabled={done} onClick={() => answer(q, i)}>
                        <span>{o}</span>
                        {r && i === r.answer && <span className="mark"><Icon name="check" size={16} />Correct answer</span>}
                        {r && i === r.choice && i !== r.answer && <span className="mark"><Icon name="close" size={16} />Your answer</span>}
                      </button>
                    );
                  })}
                  <div className="quiz-result" role="status" aria-live="polite">
                    {r && (r.correct ? <span className="chip lime">Correct! +{r.points} points</span> : <span className="chip danger">Not quite. The right answer is marked above.</span>)}
                    {!r && q.correct != null && <span className="chip">{Number(q.correct) === 1 ? 'Answered correctly' : 'Already answered'}</span>}
                  </div>
                </article>
              );
            })}
          </div>
          <AskTeacher classes={classes} />
        </>
      )}
    </div>
  );
}
