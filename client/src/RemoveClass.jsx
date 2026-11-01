import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon, useToast } from './ui';

export const sameName = (typed, name) => String(typed).trim().toLowerCase() === String(name).trim().toLowerCase();
const n = (x, word) => `${x} ${word}${x === 1 ? '' : 's'}`;

/** Confirmation box for removing a class for good. The teacher must type the class name before the red button works. */
export function RemovePanel({ cls, onClose, onDone }) {
  const toast = useToast();
  const [info, setInfo] = useState(null), [typed, setTyped] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api(`/classes/${cls.id}/removal-info`).then(setInfo).catch(e => setErr(e.message)); }, [cls.id]);

  const remove = async () => {
    setBusy(true); setErr('');
    try { await api(`/classes/${cls.id}/remove`, { method: 'POST', body: { confirm: typed } }); toast(`Class "${cls.name}" was removed`, 6000); onDone(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="remove-panel" role="group" aria-label={`Remove class ${cls.name}`}>
      <p style={{ margin: 0 }}><b>Remove "{cls.name}" for good?</b></p>
      {!info && !err && <p className="muted" role="status">Checking what is in this class…</p>}
      {info && (
        <>
          <p className="muted" style={{ margin: '.4rem 0 0' }}>This cannot be undone. These will be deleted:</p>
          <ul className="remove-list">
            <li>{n(info.students, 'student')} will be taken out of the class</li>
            <li>{n(info.missions, 'mission')} and {n(info.photos, 'photo')} sent by students</li>
            <li>{n(info.questions, 'quiz question')} you wrote, {n(info.announcements, 'announcement')} and {n(info.challenges, 'team challenge')}</li>
          </ul>
          <p style={{ margin: 0 }}>Students keep their points, levels, badges and streaks.</p>
          <label className="field" style={{ marginTop: '.75rem' }}>
            <span className="label">Type the class name to confirm: <b>{cls.name}</b></span>
            <input value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </label>
        </>
      )}
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      <div className="row">
        <button type="button" className="btn btn-danger" disabled={!info || !sameName(typed, cls.name) || busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete class permanently'}</button>
        <button type="button" className="btn btn-line" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
