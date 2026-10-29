import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon, useToast } from './ui';
import './missionform.css';

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * Post a mission. classes = [{id, name}] the teacher may post to.
 * With projectId it posts a project mission into the chosen class; otherwise a normal class mission.
 */
export default function MissionForm({ classes, classId, onClassChange, projectId, title = 'New mission', bare, onPosted }) {
  const toast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [f, setF] = useState({ title: '', description: '', points: 10, deadline: '', subjects: ['environment'] });
  const [cid, setCid] = useState(classId || classes[0]?.id);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api('/subjects').then(setSubjects).catch(() => {}); }, []);
  useEffect(() => { if (classId) setCid(classId); }, [classId]);
  const cls = classes.find(c => c.id === +cid) || classes[0];

  const toggle = slug => setF(x => ({ ...x, subjects: x.subjects.includes(slug) ? x.subjects.filter(s => s !== slug) : [...x.subjects, slug] }));
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!f.subjects.length) return setErr('Pick at least one subject.');
    const body = { title: f.title, description: f.description, points: +f.points, subjects: f.subjects, ...(f.deadline && { deadline: f.deadline }) };
    setBusy(true);
    try {
      if (projectId) await api(`/projects/${projectId}/missions`, { method: 'POST', body: { ...body, class_id: cls.id } });
      else await api(`/classes/${cls.id}/missions`, { method: 'POST', body });
      setF({ ...f, title: '', description: '', deadline: '' }); toast('Mission posted'); onPosted?.();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const share = f.subjects.length > 1 ? Math.floor(f.points / f.subjects.length) : null;
  return (
    <form className={bare ? '' : 'card paper'} onSubmit={submit}>
      <h2>{title}</h2>
      <p className="muted">Students in {cls?.name} will see it under Tasks{projectId ? ', marked as part of the project' : ''}.</p>
      <div className="stack" style={{ gap: '.75rem', marginTop: '.75rem' }}>
        {classes.length > 1 && <label className="field"><span className="label">Post to class</span><select value={cls.id} onChange={e => { setCid(+e.target.value); onClassChange?.(+e.target.value); }}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        <label className="field"><span className="label">Title</span><input required maxLength="200" placeholder="e.g. Plant a sapling" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
        <label className="field"><span className="label">What should students do?</span><input maxLength="2000" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
        <fieldset className="mf-subjects"><legend className="label">Subjects (pick one or more)</legend>
          {subjects.map(s => (
            <label key={s.slug} style={{ '--c': s.color }}><input type="checkbox" checked={f.subjects.includes(s.slug)} onChange={() => toggle(s.slug)} />
              <span><span className="tick" aria-hidden="true"><Icon name="check" size={14} /></span><span aria-hidden="true">{s.icon}</span>{s.name}</span></label>
          ))}
        </fieldset>
        <div className="mf-row">
          <label className="field"><span className="label">Points (1–100)</span><input type="number" min="1" max="100" required value={f.points} onChange={e => setF({ ...f, points: e.target.value })} /></label>
          <label className="field"><span className="label">Deadline (optional)</span><input type="date" min={todayStr()} value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} /></label>
        </div>
        <p className="muted" style={{ margin: 0 }}>{share ? `Points are split evenly: about ${share} per subject. ` : ''}{f.deadline ? 'Students can send their photo until the end of that day.' : 'With no deadline, students can send their photo any time.'}</p>
        {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
        <div className="row" style={{ margin: 0 }}><button className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post mission'}</button></div>
      </div>
    </form>
  );
}
