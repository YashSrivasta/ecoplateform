import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from './api';
import { useAuth, useToast } from './ui';
import './joinlink.css';

const CODE = /^[A-Za-z0-9]{4,12}$/;
const forget = () => { try { sessionStorage.removeItem('joinCode'); } catch {} };

/** The page a student lands on from a teacher's class share link (/join/CODE). Works before and after login. */
export default function JoinLink() {
  const { code: raw } = useParams();
  const { user } = useAuth(), toast = useToast(), nav = useNavigate();
  const code = CODE.test(raw || '') ? raw.toUpperCase() : null;
  const [info, setInfo] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const student = user?.role === 'student';

  // remember the code, so a student who still has to log in or sign up is brought back here afterwards
  useEffect(() => { if (code) { try { sessionStorage.setItem('joinCode', code); } catch {} } }, [code]);
  useEffect(() => { if (code && student) api(`/classes/preview/${code}`).then(setInfo).catch(e => setErr(e.message)); }, [code, student]);

  const join = async () => {
    setBusy(true); setErr('');
    try { const r = await api('/classes/join', { method: 'POST', body: { code } }); forget(); toast('You joined ' + r.class); nav('/student'); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  const later = () => { forget(); nav('/student'); };

  let body;
  if (!code) body = (<><h1>This link does not look right</h1><p className="muted">Ask your teacher to send the class link or the class code again.</p><Link className="btn btn-primary" to="/">Go to EcoQuest</Link></>);
  else if (!user) body = (<><h1>You are invited to join a class</h1><p className="muted">Log in or create a student account. On the next page, choose Student. You will then come straight back here to join.</p><Link className="btn btn-primary" to="/login">Log in or sign up</Link></>);
  else if (!student) body = (<><h1>This link is for students</h1><p className="muted">You are logged in as a teacher. To join as a student, log out and use a student account.</p><Link className="btn btn-primary" to="/teacher">Back to my dashboard</Link></>);
  else if (err && !info) body = (<><h1>We could not find this class</h1><p className="alert" role="alert">{err}</p><p className="muted">Check the link or code with your teacher.</p><Link className="btn btn-primary" to="/student" onClick={forget}>Go to my dashboard</Link></>);
  else if (!info) body = <p className="muted" role="status">Checking the class…</p>;
  else body = (
    <>
      <h1>Join {info.name}?</h1>
      <p className="muted">Teacher: {info.teacher}</p>
      {err && <p className="alert" role="alert">{err}</p>}
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={join} disabled={busy}>{busy ? 'Joining…' : 'Join class'}</button>
        <button type="button" className="btn btn-line" onClick={later} disabled={busy}>Not now</button>
      </div>
    </>
  );
  return (
    <main className="join-page">
      <section className="card paper join-box">
        <img src="/logo-full.png" alt="EcoQuest" width="172" height="64" />
        {body}
      </section>
    </main>
  );
}
