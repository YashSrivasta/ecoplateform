import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon, Loading, useToast } from './ui';
import { ReadButton } from './a11y';
import { useCelebrate } from './Celebrate';
import './daily.css';

/** Daily challenges: one question per subject per day, worth double points. onChange() lets the page refresh points and streak. */
export default function Daily({ onChange }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);   // subject slug being played
  const [res, setRes] = useState(null);     // {choice, correct, answer, points}
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const celebrate = useCelebrate();
  const load = () => api('/daily').then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);

  if (err) return <section className="card" id="daily"><h2>Daily challenges</h2><p className="muted">{err}</p></section>;
  if (!d) return <section className="card" id="daily"><h2>Daily challenges</h2><Loading /></section>;

  const cur = d.challenges.find(c => c.subject === open);
  const total = d.challenges.length, done = d.challenges.filter(c => c.done).length;

  const pick = async (choice) => {
    if (busy || res) return;
    setBusy(true);
    try {
      const r = await api(`/daily/${cur.subject}/answer`, { method: 'POST', body: { choice } });
      setRes({ choice, ...r });
      celebrate(r.newBadges);
      onChange?.(r);
    } catch (x) {
      if (x.status === 409) { toast('You already played this one today.'); setOpen(null); load(); } else toast(x.message);
    }
    setBusy(false);
  };
  const close = () => { setOpen(null); setRes(null); load(); };
  const choose = slug => { if (open === slug) return close(); setRes(null); setOpen(slug); };

  return (
    <section className="card" id="daily">
      <div className="between row" style={{ margin: 0 }}>
        <div><h2>Daily challenges</h2><p className="muted">One question in each subject, every day. Double points!</p></div>
        <span className="chip lime">{done} of {total} done today</span>
      </div>
      <div className="daily-tabs">
        {d.challenges.map(c => {
          const can = !c.done && c.quiz;
          return (
            <button key={c.subject} type="button" className={'dtab' + (c.done ? ' done' : '')} style={{ '--c': c.color }} disabled={!can}
              aria-expanded={open === c.subject} onClick={() => choose(c.subject)}>
              <span className="em" aria-hidden="true">{c.icon}</span>
              <b>{c.name}</b>
              <small>{c.done ? <><Icon name="check" size={14} />Done · +{c.earned} pts</> : c.quiz ? `Play · up to ${c.max_points} pts` : 'No question today'}</small>
            </button>
          );
        })}
      </div>

      {cur?.quiz && (
        <div className="daily-q" role="group" aria-label={`${cur.name} daily challenge`}>
          <div className="quiz-top">
            <span className="chip" style={{ background: cur.color, color: '#10140a' }}>{cur.icon} {cur.name}</span>
            <span className="chip">Worth {cur.max_points} points</span>
          </div>
          <div className="between row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <h3 className="quiz-q">{cur.quiz.question}</h3>
            <ReadButton text={`${cur.quiz.question}. ${cur.quiz.options.map((o, i) => `Option ${i + 1}: ${o}`).join('. ')}`} label="Read the question aloud" />
          </div>
          {cur.quiz.options.map((o, i) => {
            const state = !res ? '' : i === res.answer ? 'right' : i === res.choice ? 'wrong' : 'dim';
            return (
              <button key={i} type="button" className={'opt ' + state} disabled={!!res || busy} onClick={() => pick(i)}>
                <span>{o}</span>
                {res && i === res.answer && <span className="mark"><Icon name="check" size={16} />Correct answer</span>}
                {res && i === res.choice && i !== res.answer && <span className="mark"><Icon name="close" size={16} />Your answer</span>}
              </button>
            );
          })}
          <div className="quiz-result" role="status" aria-live="polite">
            {res && <>
              <p><b>{res.correct ? `Correct! You earned ${res.points} points.` : 'Not quite. No points this time, but you kept your streak going.'}</b></p>
              <div className="row"><button type="button" className="btn btn-primary" onClick={close}>Done</button></div>
            </>}
          </div>
        </div>
      )}
    </section>
  );
}
