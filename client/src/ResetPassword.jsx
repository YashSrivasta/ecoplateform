import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from './api';
import { Icon } from './ui';
import { strength } from './Login';
import './joinlink.css';

const TOKEN = /^[a-f0-9]{64}$/;

/** Step 2 of "forgot password": opened from the emailed link, the person chooses a new password. */
export default function ResetPassword() {
  const { token } = useParams();
  const [pw, setPw] = useState(''), [again, setAgain] = useState(''), [show, setShow] = useState(false);
  const [err, setErr] = useState(''), [bad, setBad] = useState(!TOKEN.test(token || '')), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const s = strength(pw);

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (pw !== again) return setErr('The two passwords are not the same.');
    if (s.score < 2) return setErr('Please choose a stronger password.');
    setBusy(true);
    try { await api('/auth/reset', { method: 'POST', body: { token, password: pw } }); setDone(true); }
    catch (x) { if (x.data?.code === 'bad_token') setBad(true); else setErr(x.message); }
    setBusy(false);
  };

  let body;
  if (done) body = (<><h1 id="rp-title">Your password was changed</h1><p>You can now log in with your new password.</p><Link className="btn btn-primary" to="/login">Log in</Link></>);
  else if (bad) body = (<><h1 id="rp-title">This link does not work</h1><p className="muted">It may have expired (links last 30 minutes) or it was already used. You can ask for a new one.</p><div className="row"><Link className="btn btn-primary" to="/forgot-password">Get a new link</Link><Link className="btn btn-line" to="/login">Back to log in</Link></div></>);
  else body = (
    <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 id="rp-title">Choose a new password</h1>
      <label className="field"><span className="label">New password</span>
        <span className="pw">
          <input type={show ? 'text' : 'password'} minLength="8" required autoComplete="new-password" autoFocus placeholder="At least 8 characters" aria-describedby="rp-help" value={pw} onChange={e => setPw(e.target.value)} />
          <button type="button" className="link" onClick={() => setShow(v => !v)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
        </span>
      </label>
      {pw && <p id="rp-help" className="muted" role="status"><b>Password strength: {s.label}.</b> {s.tip}</p>}
      <label className="field"><span className="label">Type it again</span><input type={show ? 'text' : 'password'} minLength="8" required autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} /></label>
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
    </form>
  );
  return (
    <main className="join-page">
      <section className="card paper join-box" aria-labelledby="rp-title">
        <img src="/logo-full.png" alt="EcoQuest" width="172" height="64" />
        {body}
      </section>
    </main>
  );
}
