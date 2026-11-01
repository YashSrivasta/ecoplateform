import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import { Icon } from './ui';
import './joinlink.css';

/** Step 1 of "forgot password": the person types their email and we send a link. */
export default function ForgotPassword() {
  const [email, setEmail] = useState(''), [sent, setSent] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api('/auth/forgot', { method: 'POST', body: { email } }); setSent(true); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <main className="join-page">
      <section className="card paper join-box" aria-labelledby="fp-title">
        <img src="/logo-full.png" alt="EcoQuest" width="172" height="64" />
        {sent ? (
          <>
            <h1 id="fp-title">Check your email</h1>
            <p>If <b>{email.trim()}</b> has an EcoQuest account, we have sent a link to choose a new password. The link works for 30 minutes and only once.</p>
            <p className="muted">It can take a few minutes. Look in your spam or junk folder too.</p>
            <div className="row">
              <Link className="btn btn-primary" to="/login">Back to log in</Link>
              <button type="button" className="btn btn-line" onClick={() => setSent(false)}>Use a different email</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h1 id="fp-title">Forgot your password?</h1>
            <p className="muted">Type the email you signed up with. We will email you a link to choose a new password.</p>
            <label className="field"><span className="label">Email</span><input type="email" required autoComplete="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} /></label>
            {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
            <div className="row">
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send me the link'}</button>
              <Link className="btn btn-line" to="/login">Back to log in</Link>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
