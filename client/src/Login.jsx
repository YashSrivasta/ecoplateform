import { useState } from 'react'; import { api } from './api'; import { useAuth } from './App';
export default function Login() {
  const { login } = useAuth(); const [role, setRole] = useState('student'); const [reg, setReg] = useState(false); const [f, setF] = useState({}); const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => { e.preventDefault(); setErr(''); try { login(await api(reg ? '/auth/register' : '/auth/login', { method: 'POST', body: { ...f, role } })); } catch (x) { setErr(x.message); } };
  return <div className="hero"><div className="hero-text"><h1>EcoQuest</h1><p>Learn about our planet, complete green missions, and earn badges with your class.</p></div>
    <form className="card login" onSubmit={submit}>
      <div className="tabs">{['student', 'teacher'].map(r => <button type="button" key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>{r === 'student' ? '🎒 Student' : '🍎 Teacher'}</button>)}</div>
      <h3>{reg ? 'Create your' : 'Log in to your'} {role} account</h3>
      {reg && <input placeholder="Full name" required onChange={set('name')} />}
      {reg && role === 'student' && <input type="number" min="1" max="20" placeholder="Class (1–12, college 13+)" required onChange={set('grade')} />}
      <input type="email" placeholder="Email" required onChange={set('email')} />
      <input type="password" minLength="8" placeholder="Password (8+ characters)" required onChange={set('password')} />
      {err && <p className="err">{err}</p>}
      <button className="primary">{reg ? 'Sign up' : 'Log in'}</button>
      <a className="link" onClick={() => setReg(!reg)}>{reg ? 'I already have an account' : 'New here? Create an account'}</a>
    </form></div>;
}
