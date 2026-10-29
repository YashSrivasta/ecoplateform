import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Icon, useAuth } from './ui';
import { A11yBar } from './a11y';

const SUBJECTS = [ // same five as /api/subjects; the login page cannot call that route before sign-in
  { slug: 'math', name: 'Math', color: '#4da3ff', icon: '➗', line: 'Numbers, patterns and puzzles that click.' },
  { slug: 'science', name: 'Science', color: '#b583ff', icon: '🔬', line: 'Ask why, then test it.' },
  { slug: 'environment', name: 'Environment', color: '#d6ff00', icon: '🌱', line: 'Small actions that help the planet.' },
  { slug: 'coding', name: 'Coding', color: '#ff9f43', icon: '💻', line: 'Tell computers what to do.' },
  { slug: 'literature', name: 'Literature', color: '#ff6b9d', icon: '📚', line: 'Stories, poems and big ideas.' },
];
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Banner() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(reduced());
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (paused || hover) return;
    const t = setInterval(() => setI(x => (x + 1) % SUBJECTS.length), 3800);
    return () => clearInterval(t);
  }, [paused, hover]);
  const s = SUBJECTS[i];
  return (
    <div className="banner" style={{ '--sub': s.color }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} role="region" aria-roledescription="carousel" aria-label="Subjects you can learn">
      <div className="banner-body" aria-live={paused ? 'polite' : 'off'}>
        <span className="banner-ico" aria-hidden="true">{s.icon}</span>
        <div><b>{s.name}</b><p>{s.line}</p></div>
      </div>
      <div className="banner-ctl">
        <div className="dots" role="group" aria-label="Choose a subject">
          {SUBJECTS.map((x, k) => <button type="button" key={x.slug} className={'dotbtn' + (k === i ? ' on' : '')} aria-label={`${x.name}${k === i ? ' (showing)' : ''}`} aria-current={k === i} onClick={() => setI(k)} />)}
        </div>
        <button type="button" className="link" onClick={() => setPaused(p => !p)} aria-label={paused ? 'Start rotating subjects' : 'Pause rotating subjects'}><Icon name={paused ? 'play' : 'pause'} size={16} /></button>
      </div>
    </div>
  );
}

export function strength(pw) {
  if (!pw) return { score: 0, label: '', tip: '' };
  let n = 0;
  if (pw.length >= 8) n++;
  if (pw.length >= 12) n++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
  if (/\d/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw)) n++;
  if (pw.length < 8) return { score: 1, label: 'Too short', tip: 'Use at least 8 characters.' };
  if (/^(password|12345678|qwerty|iloveyou)/i.test(pw)) return { score: 1, label: 'Weak', tip: 'That is easy to guess. Try a few unrelated words.' };
  const score = Math.max(1, Math.min(4, n - 0)); // 1..4
  const label = ['', 'Weak', 'Okay', 'Good', 'Strong'][score];
  const tip = score >= 3 ? '' : 'Add a longer phrase, capital letters, numbers or a symbol.';
  return { score, label, tip };
}
function Meter({ pw }) {
  const s = strength(pw);
  if (!pw) return null;
  return (
    <div className="meter" id="pw-help">
      <div className="meter-bar" aria-hidden="true">{[1, 2, 3, 4].map(k => <i key={k} className={k <= s.score ? 'on s' + s.score : ''} />)}</div>
      <p><b>Password strength: {s.label}.</b> <span className="muted">{s.tip}</span></p>
    </div>
  );
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
function loadGsi() {
  return new Promise((res, rej) => {
    if (window.google?.accounts?.id) return res();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}

export default function Login() {
  const { login } = useAuth();
  const [role, setRole] = useState('student');
  const [reg, setReg] = useState(false);
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  const gbox = useRef(null);
  const live = useRef({}); live.current = { role, grade: f.grade, reg };
  const set = k => e => setF({ ...f, [k]: e.target.value });

  useEffect(() => { // show the Google button only when the server says it is set up
    if (!CLIENT_ID) return;
    let off = false;
    api('/auth/config').then(c => c.google && loadGsi().then(() => !off && setGoogle(true))).catch(() => {});
    return () => { off = true; };
  }, []);
  useEffect(() => {
    if (!google || !gbox.current) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async r => {
        setErr(''); const { role, grade } = live.current;
        try { login(await api('/auth/google', { method: 'POST', body: { credential: r.credential, role, ...(role === 'student' && grade && { grade: +grade }) } })); }
        catch (x) {
          if (x.data?.needs_grade) { setReg(true); setErr('New student account: enter your class below, then press "Continue with Google" again.'); } else setErr(x.message);
        }
      },
    });
    window.google.accounts.id.renderButton(gbox.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 360 });
  }, [google]);

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (reg && strength(f.password).score < 2) return setErr('Please choose a stronger password.');
    setBusy(true);
    try { login(await api(reg ? '/auth/register' : '/auth/login', { method: 'POST', body: { ...f, ...(f.grade && { grade: +f.grade }), role } })); }
    catch (x) { setErr(x.status === 429 && x.data?.retry_after ? `Too many tries. Please wait ${Math.ceil(x.data.retry_after / 60)} minute(s) and try again.` : x.message); }
    setBusy(false);
  };

  return (
    <div className="login-wrap">
      <div className="login-tools"><A11yBar target=".login-wrap" /></div>
      <section className="login-hero">
        <img className="login-logo" src="/logo-full.png" alt="EcoQuest" width="280" height="104" />
        <h1>Learn. Play. Grow.</h1>
        <p className="lead">One place for Math, Science, Environment, Coding and Literature. Earn points, keep your streak and level up with your class.</p>
        <Banner />
        <ul className="ticks">
          {['Daily challenges in every subject', 'Missions you prove with a photo', 'Points, levels and badges you earn with your class'].map(t => <li key={t}><span className="ico"><Icon name="check" size={16} /></span>{t}</li>)}
        </ul>
      </section>
      <form className="card login-card" id="main" onSubmit={submit}>
        <div className="seg" role="tablist" aria-label="Account type">
          {['student', 'teacher'].map(r => <button type="button" role="tab" aria-selected={role === r} key={r} className={role === r ? 'on' : ''} onClick={() => { setRole(r); setErr(''); }}>{r === 'student' ? 'Student' : 'Teacher'}</button>)}
        </div>
        <h2>{reg ? `Create your ${role} account` : `Log in as a ${role}`}</h2>
        {reg && <label className="field"><span className="label">Full name</span><input required autoComplete="name" value={f.name || ''} onChange={set('name')} /></label>}
        {role === 'student' && (reg || google) && <label className="field"><span className="label">Class (1–12, college 13+){!reg && ' · only needed the first time you use Google'}</span><input type="number" inputMode="numeric" min="1" max="20" required={reg} value={f.grade || ''} onChange={set('grade')} /></label>}
        <label className="field"><span className="label">Email</span><input type="email" required autoComplete="email" value={f.email || ''} onChange={set('email')} /></label>
        <label className="field"><span className="label">Password</span>
          <span className="pw">
            <input type={show ? 'text' : 'password'} minLength="8" required autoComplete={reg ? 'new-password' : 'current-password'} placeholder="At least 8 characters" aria-describedby={reg ? 'pw-help' : undefined} value={f.password || ''} onChange={set('password')} />
            <button type="button" className="link" onClick={() => setShow(s => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        {reg && <Meter pw={f.password} />}
        {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Please wait…' : reg ? 'Sign up' : 'Log in'}</button>
        {google && <><div className="or"><span>or</span></div><div ref={gbox} className="gbox" /></>}
        <button type="button" className="link" onClick={() => { setReg(!reg); setErr(''); }}>{reg ? 'I already have an account' : 'New here? Create an account'}</button>
      </form>
    </div>
  );
}
