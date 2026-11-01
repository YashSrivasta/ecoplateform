import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from './api';
import { Icon, Loading, Pick, useToast } from './ui';
import './quizbuilder.css';

const LETTERS = ['A', 'B', 'C', 'D'];
const blank = () => ({ subject: 'environment', difficulty: 1, grade_min: 1, grade_max: 12, question: '', options: ['', '', '', ''], correct: 0 });

export default function QuizBuilder() {
  const ctx = useOutletContext(), toast = useToast();
  const [subjects, setSubjects] = useState([]), [list, setList] = useState(null), [f, setF] = useState(blank());
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const owner = ctx.cls?.owner;
  const load = () => ctx.classId && api(`/classes/${ctx.classId}/quizzes`).then(setList).catch(e => { setErr(e.message); setList([]); });
  useEffect(() => { api('/subjects').then(setSubjects).catch(() => {}); }, []);
  useEffect(() => { setList(null); setErr(''); load(); }, [ctx.classId]);

  const setOpt = (i, v) => setF(x => ({ ...x, options: x.options.map((o, j) => (j === i ? v : o)) }));
  const submit = async e => {
    e.preventDefault(); setErr('');
    const kept = f.options.map((text, i) => ({ text: text.trim(), i })).filter(o => o.text);
    if (kept.length < 2) return setErr('Write at least two answer options.');
    const answer = kept.findIndex(o => o.i === f.correct);
    if (answer < 0) return setErr('Mark one of the filled options as the correct answer.');
    setBusy(true);
    try {
      await api(`/classes/${ctx.classId}/quizzes`, { method: 'POST', body: { subject: f.subject, difficulty: +f.difficulty, grade_min: +f.grade_min, grade_max: +f.grade_max, question: f.question, options: kept.map(o => o.text), answer } });
      setF(x => ({ ...blank(), subject: x.subject, difficulty: x.difficulty, grade_min: x.grade_min, grade_max: x.grade_max })); toast('Question added'); load();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const remove = async q => {
    if (!window.confirm('Remove this question? Students will no longer see it. Points already earned are kept.')) return;
    try { await api(`/classes/${ctx.classId}/quizzes/${q.id}`, { method: 'DELETE' }); toast('Question removed'); load(); } catch (x) { setErr(x.message); }
  };

  return (
    <>
      <header className="page-head"><div><h1>Quiz builder</h1><p className="muted">Write your own questions. Only students in the class you pick will see them.</p></div></header>
      <Pick ctx={ctx} />
      {ctx.cls && !owner && <p className="chip warn" style={{ alignSelf: 'flex-start' }}>You can view this class, but only {ctx.cls.creator} can add or remove questions.</p>}
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      {ctx.classId && owner && (
        <form className="card paper" onSubmit={submit}>
          <h2>New question</h2><p className="muted">For {ctx.cls.name}. Harder questions are worth more points.</p>
          <div className="stack" style={{ gap: '.75rem', marginTop: '.75rem' }}>
            <div className="qb-row">
              <label className="field"><span className="label">Subject</span>
                <select value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })}>{subjects.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label>
              <label className="field"><span className="label">Difficulty</span>
                <select value={f.difficulty} onChange={e => setF({ ...f, difficulty: e.target.value })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} of 5 · {n * 5} points</option>)}</select></label>
              <label className="field"><span className="label">For class from</span>
                <input type="number" min="1" max="20" required value={f.grade_min} onChange={e => setF({ ...f, grade_min: e.target.value })} /></label>
              <label className="field"><span className="label">to</span>
                <input type="number" min="1" max="20" required value={f.grade_max} onChange={e => setF({ ...f, grade_max: e.target.value })} /></label>
            </div>
            <label className="field"><span className="label">Question</span>
              <textarea rows={2} required minLength={5} maxLength={300} value={f.question} onChange={e => setF({ ...f, question: e.target.value })} /></label>
            <fieldset className="qb-opts">
              <legend className="label">Answer options (2 to 4). Tick the correct one.</legend>
              {f.options.map((o, i) => (
                <div className="qb-opt" key={i}>
                  <input type="radio" name="correct" aria-label={`Option ${LETTERS[i]} is correct`} checked={f.correct === i} onChange={() => setF({ ...f, correct: i })} />
                  <input aria-label={`Option ${LETTERS[i]}`} placeholder={`Option ${LETTERS[i]}${i < 2 ? '' : ' (optional)'}`} maxLength={120} required={i < 2} value={o} onChange={e => setOpt(i, e.target.value)} />
                </div>
              ))}
            </fieldset>
          </div>
          <div className="row"><button className="btn btn-primary" disabled={busy}><Icon name="plus" size={18} />Add question</button></div>
        </form>
      )}
      <h2 style={{ marginTop: '.5rem' }}>Questions for this class</h2>
      {ctx.classId && !list && <Loading />}
      {list && !list.length && !err && <p className="muted">No questions yet. Add your first one above.</p>}
      <div className="stack">
        {(list || []).map(q => (
          <article className="card" key={q.id}>
            <div className="chips" style={{ marginTop: 0 }}>
              <span className="chip">{q.subject_name}</span><span className="chip">Difficulty {q.difficulty} · {q.difficulty * 5} points</span><span className="chip">Class {q.grade_min} to {q.grade_max}</span>
              <span className="chip">{Number(q.attempts)} answered · {Number(q.right_count)} correct</span>
            </div>
            <h3 className="qb-q">{q.question}</h3>
            <ol className="qb-list" type="A">
              {q.options.map((o, i) => <li key={i} className={i === q.answer ? 'right' : ''}>{o}{i === q.answer && <span className="qb-ok"><Icon name="check" size={16} /> Correct answer</span>}</li>)}
            </ol>
            {owner && <div className="row"><button type="button" className="btn btn-danger" onClick={() => remove(q)}>Remove</button></div>}
          </article>
        ))}
      </div>
    </>
  );
}
