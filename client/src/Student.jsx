import { useEffect, useState } from 'react'; import { useOutletContext } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'; import { api, img } from './api';
export const Avatar = ({ u, big }) => u.photo ? <img className={'av' + (big ? ' big' : '')} src={img(u.photo)} /> : <div className={'av' + (big ? ' big' : '')}>{u.name[0]}</div>;
function Join({ onDone }) {
  const [code, setCode] = useState(''), [msg, setMsg] = useState('');
  const go = async () => { try { const r = await api('/classes/join', { method: 'POST', body: { code } }); setMsg('Joined ' + r.class + '!'); onDone(); } catch (e) { setMsg(e.message); } };
  return <div className="card"><h3>Join a class</h3><p>Ask your teacher for the class code. You need a class to take quizzes and upload missions.</p>
    <div className="row"><input placeholder="Class code" value={code} onChange={e => setCode(e.target.value)} /><button className="primary" onClick={go}>Join class</button></div>{msg && <p>{msg}</p>}</div>;
}
export function SDash() {
  const [d, setD] = useState(null); const load = () => api('/student/dashboard').then(setD); useEffect(() => { load(); }, []);
  if (!d) return <p>Loading…</p>;
  return <><div className="card row"><Avatar u={d.user} big /><div><h1>Hi, {d.user.name}!</h1><p>Class {d.user.grade} · {d.points} points · Level {d.level}</p>
    <div className="bar"><i style={{ width: d.levelProgress + '%' }} /></div><small>{d.levelProgress}/100 to level {d.level + 1}</small></div></div>
    {!d.classes.length && <Join onDone={load} />}
    <div className="grid"><div className="card"><h3>Progress</h3>{d.chart.length ? <ResponsiveContainer height={200}><AreaChart data={d.chart}><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Area dataKey="points" stroke="#1f9d55" fill="#bdebd0" /></AreaChart></ResponsiveContainer> : <p>Earn points to see your chart grow.</p>}</div>
      <div className="card"><h3>Badges</h3><div className="badges">{d.badges.map(b => <div key={b.name} className={b.earned ? 'badge' : 'badge off'}><span>{b.icon}</span>{b.name}<small>{b.at} pts</small></div>)}</div></div></div>
    <div className="card"><h3>Daily activity</h3>{d.activity.length ? d.activity.map((a, i) => <p key={i} className="act"><b>+{a.points}</b> {a.text}<small>{a.created_at.slice(0, 10)}</small></p>) : <p>No activity yet. Try a quiz or mission!</p>}</div></>;
}


export function Quizzes() {
  const [qs, setQs] = useState([]),
    [res, setRes] = useState({}),
    [err, setErr] = useState(""),
    [dm, setDm] = useState({ class_id: "", message: "" }),
    [classes, setClasses] = useState([]),
    [mine, setMine] = useState([]);

  const load = () => {
    api("/quizzes").then(setQs).catch(e => setErr(e.message));
    api("/doubts").then(setMine).catch(() => {});
  };

  useEffect(() => {
    load();
    api("/student/dashboard").then(d => {
      setClasses(d.classes);
      setDm(x => ({ ...x, class_id: d.classes[0]?.id || "" }));
    });
  }, []);

  const answer = async (q, choice) => {
    try {
      setRes({
        ...res,
        [q.id]: await api(`/quizzes/${q.id}/answer`, {
          method: "POST",
          body: { choice }
        })
      });
    } catch (e) {
      setErr(e.message);
    }
  };

  const ask = async () => {
    try {
      await api("/doubts", { method: "POST", body: dm });
      setDm({ ...dm, message: "" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

 return (
  <div className="quiz-layout">
    <div className="quiz-section">
      <h1>Quiz Hub</h1>
      <p>Questions for your class level. Harder questions are worth more points.</p>
      {err && <p className="err">{err}</p>}

      {qs.map(q => {
        const r = res[q.id], done = r || q.correct != null;
        return (
          <div className="card" key={q.id}>
            <small>Difficulty {"⭐".repeat(q.difficulty)}</small>
            <h3>{q.question}</h3>
            {q.options.map((o, i) => (
              <button
                key={i}
                disabled={done}
                className={"opt" + (r && r.answer === i ? " right" : "")}
                onClick={() => answer(q, i)}
              >
                {o}
              </button>
            ))}
            {r && <p>{r.correct ? `Correct! +${r.points} points` : "Not quite — the right answer is highlighted."}</p>}
            {!r && q.correct != null && <p>Already answered.</p>}
          </div>
        );
      })}
    </div>

    {/* Chatbot-style teacher box */}
    <div className="teacher-chatbot">
      <div className="card">
        <h3>Ask your teacher</h3>
        <div className="row">
          <select
            value={dm.class_id}
            onChange={e => setDm({ ...dm, class_id: e.target.value })}
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <textarea
            placeholder="Describe your doubt"
            value={dm.message}
            onChange={e => setDm({ ...dm, message: e.target.value })}
            rows={2} /* initial size */
            className="doubt-box"
          />

          <button className="primary" onClick={ask}>Send</button>
        </div>
        {mine.map((m, i) => (
          <p key={i}>
            <b>You:</b> {m.message}<br />
            <b>Teacher:</b> {m.reply || "Waiting for reply…"}
          </p>
        ))}
      </div>
    </div>
  </div>
);

}

export function Tasks() {
  const [ms, setMs] = useState([]), [err, setErr] = useState(''), [dash, setDash] = useState(null);
  const load = () => api('/missions').then(m => { setMs(m); const seen = JSON.parse(localStorage.getItem('seen') || '[]'), fresh = m.filter(x => x.status === 'approved' && !seen.includes(x.id));
    if (fresh.length) { alert('Work accepted successfully.'); localStorage.setItem('seen', JSON.stringify([...seen, ...fresh.map(x => x.id)])); } });
  useEffect(() => { load(); api('/student/dashboard').then(setDash); }, []);
  const up = async (m, file) => { if (!file) return; const form = new FormData(); form.append('photo', file); try { await api(`/missions/${m.id}/submit`, { method: 'POST', form }); setErr(''); load(); } catch (e) { setErr(e.message); } };
  if (dash && !dash.classes.length) return <><h1>Tasks</h1><Join onDone={() => location.reload()} /></>;
  return <><h1>Tasks</h1><p>Complete the mission, then upload a photo as proof. Points arrive after your teacher approves.</p>{err && <p className="err">{err}</p>}
    {ms.length === 0 && <p>No missions yet. Your teacher will post some soon.</p>}
    {ms.map(m => <div className="card row between" key={m.id}><div><h3>{m.title}</h3><p>{m.description}</p><small>{m.class_name} · {m.points} points</small></div>
      <div>{m.status === 'pending' && <span className="pill y">Waiting for review</span>}{m.status === 'approved' && <span className="pill g">Approved +{m.awarded}</span>}
        {(!m.status || m.status === 'rejected') && <>{m.status === 'rejected' && <span className="pill r">Rejected — try again</span>}<label className="primary btn">Upload photo<input hidden type="file" accept="image/*" onChange={e => up(m, e.target.files[0])} /></label></>}</div></div>)}</>;
}


export function Profile() {
  const [d, setD] = useState(null);
  const load = () => api("/student/dashboard").then(setD);
  useEffect(() => { load(); }, []);

  const up = async f => {
    const form = new FormData();
    form.append("photo", f);
    await api("/me/photo", { method: "POST", form });
    load();
  };

  if (!d) return <p>Loading…</p>;

  return (
    <div className="profile-layout">
      {/* Left side: user info */}
      <div className="profile-info card">
        <Avatar u={d.user} big />
        <h1>{d.user.name}</h1>
        <p>{d.user.email}</p>
        <p>Class {d.user.grade} · {d.points} points</p>

        <label className="btn ghost">
          Change photo
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={e => e.target.files[0] && up(e.target.files[0])}
          />
        </label>

        <h3>My classes</h3>
        {d.classes.length
          ? d.classes.map(c => (
              <p key={c.id}>{c.name} — teacher {c.teacher}</p>
            ))
          : <p>Not in a class yet. Join one from the Dashboard.</p>}
      </div>

      {/* Right side: progress + stats */}
      <div className="profile-progress card">
        <h3>Progress</h3>
        <p><b>Total Points:</b> {d.points}</p>
        {d.chart.length ? (
          <ResponsiveContainer height={200}>
            <AreaChart data={d.chart}>
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Area dataKey="points" stroke="#1f9d55" fill="#bdebd0" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p>Earn points to see your chart grow.</p>
        )}

        {/* Stats summary cards */}
        <div className="stats-grid">
          <div className="stat-card"><h4>Total Points</h4><p>{d.points}</p></div>
          <div className="stat-card"><h4>Quizzes Attempted</h4><p>{d.quizzesAttempted || 0}</p></div>
          <div className="stat-card"><h4>Correct Answers %</h4><p>{d.correctPercent || 0}%</p></div>
          <div className="stat-card"><h4>Classes Joined</h4><p>{d.classes.length}</p></div>
        </div>

        {/* Personal goals */}
        <h3>Next Milestone</h3>
        <p>Earn {Math.max(0, 20 - (d.points % 20))} more points to unlock your next badge!</p>

        {/* Daily activity feed */}
        <h3>Daily Activity</h3>
        {d.activity.length ? (
          d.activity.map((a, i) => (
            <p key={i} className="act">
              <b>+{a.points}</b> {a.text}
              <small>{a.created_at.slice(0, 10)}</small>
            </p>
          ))
        ) : (
          <p>No activity yet. Try a quiz or mission!</p>
        )}
      </div>
    </div>
  );
}



