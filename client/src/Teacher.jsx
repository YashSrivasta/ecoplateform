import { useEffect, useState } from 'react'; import { useOutletContext } from 'react-router-dom'; import { api, img } from './api'; import { useAuth } from './App'; import { Avatar } from './Student';
const Pick = ({ ctx }) => <select value={ctx.classId || ''} onChange={e => ctx.setClassId(+e.target.value)}>{ctx.classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</select>;




export function TDash() {
  const ctx = useOutletContext();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [genCode, setGenCode] = useState("");   // generated class code
  const [joinCode, setJoinCode] = useState(""); // colleague’s class code
  const [msg, setMsg] = useState("");
  const [m, setM] = useState({ title: "", description: "", points: 10 });

  const call = async (fn) => {
    try {
      setMsg("");
      await fn();
      ctx.reload();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      {/* Teacher profile */}
      <div className="card teacher-profile">
        <Avatar u={user} big />
        <div className="teacher-info">
          <h1>{user.name}</h1>
          <p>{user.email}</p>
        </div>
      </div>

      {msg && <p className="err">{msg}</p>}

      {/* Classes */}
      <div className="card teacher-classes">
        <h3>My classes</h3>
        {ctx.classes.map((c) => (
          <div key={c.id} className="class-row">
            <p>
              <b>{c.name}</b> · code <span className="code">{c.code}</span> ·{" "}
              {c.students} students{" "}
              {c.owner ? "" : <span className="pill y">View only — by {c.creator}</span>}
            </p>
            {c.owner && (
              <button
                className="btn danger"
                onClick={() =>
                  call(async () => {
                    await api(`/teacher/classes/${c.id}`, { method: "DELETE" });
                    setMsg(`Class "${c.name}" removed`);
                  })
                }
              >
                Remove
              </button>
            )}
          </div>
        ))}

        {/* Create new class */}
        <div className="form-row">
          <input
            className="input-class"
            placeholder="New class name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="btn primary"
            onClick={async () => {
              const r = await api("/teacher/classes", {
                method: "POST",
                body: { name },
              });
              console.log("API response:", r);
              setName("");
              const newCode = r.code || r.class?.code || r.id; // adjust based on API response
              setMsg("New class code: " + newCode);
              setGenCode(newCode);   // ensures buttons show
              ctx.reload();          // reload classes list
            }}
          >
            Generate class code
          </button>
        </div>

        {/* Show generated code */}
        {genCode && (
          <div className="generated-code">
            <p>
              <b>Generated Code:</b> <span className="code">{genCode}</span>
            </p>
            <button
              className="btn ghost"
              onClick={() => navigator.clipboard.writeText(genCode)}
            >
              Copy Code
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                const link = `${window.location.origin}/join/${genCode}`;
                navigator.clipboard.writeText(link);
                alert("Share link copied: " + link);
              }}
            >
              Copy Share Link
            </button>
          </div>
        )}

        {/* Join colleague’s class */}
        <div className="form-row">
          <input
            className="input-class"
            placeholder="Code of a colleague's class (view only)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button
            className="btn ghost"
            onClick={() =>
              call(() =>
                api("/teacher/classes/join", { method: "POST", body: { code: joinCode } })
              )
            }
          >
            Add to my list
          </button>
        </div>
      </div>

      {/* Mission creation */}
      {ctx.cls?.owner && (
        <div className="card teacher-mission">
          <h3>New mission for {ctx.cls.name}</h3>
          <input
            className="input-mission"
            placeholder="Title (e.g. Plant a sapling)"
            value={m.title}
            onChange={(e) => setM({ ...m, title: e.target.value })}
          />
          <input
            className="input-mission"
            placeholder="What should students do?"
            value={m.description}
            onChange={(e) => setM({ ...m, description: e.target.value })}
          />
          <div className="form-row">
            <input
              className="input-points"
              type="number"
              min="1"
              max="100"
              value={m.points}
              onChange={(e) => setM({ ...m, points: e.target.value })}
            />
            <button
              className="btn primary"
              onClick={() =>
                call(async () => {
                  await api(`/classes/${ctx.classId}/missions`, {
                    method: "POST",
                    body: m,
                  });
                  setM({ title: "", description: "", points: 10 });
                  setMsg("Mission posted");
                })
              }
            >
              Post mission
            </button>
          </div>
        </div>
      )}
    </>
  );
}





export function Students() {
  const ctx = useOutletContext();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (ctx.classId) {
      api(`/classes/${ctx.classId}/students`).then(setRows);
    }
  }, [ctx.classId]);

  return (
    <>
      <h1>Students</h1>
      <Pick ctx={ctx} />
      {rows.length === 0 && (
        <p>No students yet. Share the class code so they can join.</p>
      )}

      <div className="card">
        {rows.map(r => (
          <div className="row between" key={r.id}>
            <div className="row student-inline">
              <Avatar u={r} />
              <b className="student-name">{r.name}</b>
              <small className="class-name">Class {r.grade}</small>
            </div>
            <div style={{ minWidth: 180 }}>
              <div className="bar">
                <i style={{ width: (r.points % 100) + "%" }} />
              </div>
              <small>{r.points} pts · {r.missions_done} missions</small>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function Review() {
  const ctx = useOutletContext(), [subs, setSubs] = useState([]), [doubts, setDoubts] = useState([]), [pts, setPts] = useState({}), [msg, setMsg] = useState(''), [rep, setRep] = useState({});
  const load = () => { if (!ctx.classId) return; api(`/classes/${ctx.classId}/submissions`).then(setSubs); api(`/classes/${ctx.classId}/doubts`).then(setDoubts); }; useEffect(load, [ctx.classId]);
  const review = async (s, approve) => { try { await api(`/submissions/${s.id}/review`, { method: 'POST', body: { approve, points: pts[s.id] ?? s.max_points } }); if (approve) alert('Work accepted successfully.'); load(); } catch (e) { setMsg(e.message); } };
  const reply = async d => { try { await api(`/doubts/${d.id}/reply`, { method: 'POST', body: { reply: rep[d.id] } }); load(); } catch (e) { setMsg(e.message); } };
  return <><h1>Review</h1><Pick ctx={ctx} />{!ctx.cls?.owner && ctx.cls && <p className="pill y">You can view this class, but only {ctx.cls.creator} can approve or reject.</p>}{msg && <p className="err">{msg}</p>}
    {subs.length === 0 && <p>No submissions yet.</p>}
    {subs.map(s => <div className="card row" key={s.id}><img className="proof" src={img(s.photo)} /><div><h3>{s.title}</h3><p>{s.student} · max {s.max_points} pts</p>
      {s.status === 'pending' ? (ctx.cls?.owner ? <div className="row"><input type="number" min="0" max={s.max_points} defaultValue={s.max_points} style={{ width: 80 }} onChange={e => setPts({ ...pts, [s.id]: e.target.value })} />
        <button className="primary" onClick={() => review(s, true)}>Approve</button><button className="ghost" onClick={() => review(s, false)}>Reject</button></div> : <span className="pill y">Pending</span>)
        : <span className={'pill ' + (s.status === 'approved' ? 'g' : 'r')}>{s.status} {s.status === 'approved' && `+${s.awarded}`}</span>}</div></div>)}
    <h2>Student doubts</h2>{doubts.map(d => <div className="card" key={d.id}><p><b>{d.student}:</b> {d.message}</p>{d.reply ? <p><b>Reply:</b> {d.reply}</p> : ctx.cls?.owner && <div className="row"><input placeholder="Write a reply" onChange={e => setRep({ ...rep, [d.id]: e.target.value })} /><button className="primary" onClick={() => reply(d)}>Reply</button></div>}</div>)}</>;
}
export function Assessment() {
  const ctx = useOutletContext(), [rows, setRows] = useState([]); useEffect(() => { ctx.classId && api(`/classes/${ctx.classId}/assessment`).then(setRows); }, [ctx.classId]);
  return <><h1>Assessment</h1><Pick ctx={ctx} /><div className="card scroll"><table><thead><tr><th>Student</th><th>Class</th><th>Mission points</th><th>Quiz points</th><th>Total</th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.name}><td>{r.name}</td><td>{r.grade}</td><td>{r.mission_points}</td><td>{r.quiz_points}</td><td><b>{r.mission_points + r.quiz_points}</b></td></tr>)}</tbody></table></div></>;
}
