import { useState } from 'react';
import { api } from './api';
import { Icon, useAuth } from './ui';

export default function Login() {
  const { login } = useAuth();
  const [role, setRole] = useState('student');
  const [reg, setReg] = useState(false);
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setErr('');
    try { login(await api(reg ? '/auth/register' : '/auth/login', { method: 'POST', body: { ...f, role } })); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="login-wrap">
      <section className="login-hero">
        <div className="brand" style={{ padding: 0 }}><span className="mark"><Icon name="leaf" size={20} /></span>EcoQuest</div>
        <h1>Learn about the planet. Earn points for helping it.</h1>
        <ul className="ticks">
          {['Quizzes that get harder as your class level goes up', 'Missions you prove with a photo', 'Points, levels and badges you earn with your class'].map(t => <li key={t}><span className="ico"><Icon name="check" size={16} /></span>{t}</li>)}
        </ul>
      </section>
      <form className="card login-card" onSubmit={submit}>
        <div className="seg" role="tablist" aria-label="Account type">
          {['student', 'teacher'].map(r => <button type="button" role="tab" aria-selected={role === r} key={r} className={role === r ? 'on' : ''} onClick={() => { setRole(r); setErr(''); }}>{r === 'student' ? 'Student' : 'Teacher'}</button>)}
        </div>
        <h2>{reg ? `Create your ${role} account` : `Log in as a ${role}`}</h2>
        {reg && <label className="field"><span className="label">Full name</span><input required autoComplete="name" value={f.name || ''} onChange={set('name')} /></label>}
        {reg && role === 'student' && <label className="field"><span className="label">Class (1–12, college 13+)</span><input type="number" min="1" max="20" required value={f.grade || ''} onChange={set('grade')} /></label>}
        <label className="field"><span className="label">Email</span><input type="email" required autoComplete="email" value={f.email || ''} onChange={set('email')} /></label>
        <label className="field"><span className="label">Password</span><input type="password" minLength="8" required autoComplete={reg ? 'new-password' : 'current-password'} placeholder="At least 8 characters" value={f.password || ''} onChange={set('password')} /></label>
        {err && <p className="alert" role="alert">{err}</p>}
        <button className="btn btn-primary btn-block">{reg ? 'Sign up' : 'Log in'}</button>
        <button type="button" className="link" onClick={() => { setReg(!reg); setErr(''); }}>{reg ? 'I already have an account' : 'New here? Create an account'}</button>
      </form>
    </div>
  );
}
