import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, img } from './api';
import { Icon, Loading, Pick, fmtDate, useToast } from './ui';
import Doubts from './Doubts';
import './review.css';

const TABS = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];

function Big({ s, onClose }) {
  const btn = useRef(null);
  useEffect(() => {
    const prev = document.activeElement; btn.current?.focus();
    const key = e => { if (e.key === 'Escape') onClose(); if (e.key === 'Tab') { e.preventDefault(); btn.current?.focus(); } };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, []);
  return (
    <div className="rv-big-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rv-big" role="dialog" aria-modal="true" aria-label={`Photo from ${s.student}`}>
        <img src={img(s.photo)} alt={`Photo submitted by ${s.student} for ${s.title}`} />
        <p><b>{s.student}</b> · {s.title}</p>
        <button ref={btn} type="button" className="btn btn-white" onClick={onClose}><Icon name="close" size={18} />Close</button>
      </div>
    </div>
  );
}

function Card({ s, owner, onReview, onZoom }) {
  const [pts, setPts] = useState(s.max_points);
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const bounded = Math.max(0, Math.min(+s.max_points, Math.round(+pts) || 0));
  const go = async ok => { setBusy(true); await onReview(s, ok, bounded); setBusy(false); };
  return (
    <article className="rv-card">
      {s.photo && !bad
        ? <button type="button" className="rv-thumb" onClick={() => onZoom(s)} aria-label={`Enlarge photo from ${s.student}`}><img src={img(s.photo)} alt="" loading="lazy" onError={() => setBad(true)} /><span className="zoom" aria-hidden="true">Enlarge</span></button>
        : <div className="rv-thumb none">Photo no longer available</div>}
      <div className="rv-info"><b>{s.title}</b><span className="muted">{s.student} · {fmtDate(s.created_at)}</span>
        <div className="chips"><span className="chip">Max {s.max_points} pts</span>
          {s.status === 'approved' && <span className="chip lime"><Icon name="check" size={12} />Approved +{s.awarded}</span>}
          {s.status === 'rejected' && <span className="chip danger"><Icon name="close" size={12} />Rejected</span>}
          {s.status === 'pending' && !owner && <span className="chip warn">Waiting</span>}</div></div>
      {s.status === 'pending' && owner && (
        <div className="rv-act">
          <input type="number" min="0" max={s.max_points} value={pts} onChange={e => setPts(e.target.value)} aria-label={`Points for ${s.student}`} />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => go(true)}>Approve</button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => go(false)}>Reject</button>
        </div>
      )}
    </article>
  );
}

export default function Review() {
  const ctx = useOutletContext(), toast = useToast();
  const [subs, setSubs] = useState(null), [tab, setTab] = useState('pending'), [mission, setMission] = useState(''), [err, setErr] = useState(''), [big, setBig] = useState(null);
  const load = () => ctx.classId && api(`/classes/${ctx.classId}/submissions`).then(setSubs).catch(e => { setErr(e.message); setSubs([]); });
  useEffect(() => { setSubs(null); setErr(''); setMission(''); load(); }, [ctx.classId]);
  const owner = ctx.cls?.owner;
  const review = async (s, approve, points) => {
    try {
      await api(`/submissions/${s.id}/review`, { method: 'POST', body: { approve, points } }); setErr('');
      toast(approve ? `Approved ${s.student}'s work (+${points} points)` : `Rejected ${s.student}'s submission`);
      await load();
    } catch (e) { setErr(e.message); }
  };
  const titles = useMemo(() => [...new Set((subs || []).map(s => s.title))], [subs]);
  const counts = useMemo(() => { const c = { all: 0, pending: 0, approved: 0, rejected: 0 }; (subs || []).forEach(s => { c.all++; c[s.status] = (c[s.status] || 0) + 1; }); return c; }, [subs]);
  const shown = (subs || []).filter(s => (tab === 'all' || s.status === tab) && (!mission || s.title === mission));
  return (
    <>
      <header className="page-head"><div><h1>Review</h1><p className="muted">Check each photo, then approve or reject it. Points go to the student when you approve.</p></div></header>
      <Pick ctx={ctx} />
      {ctx.cls && !owner && <p className="chip warn" style={{ alignSelf: 'flex-start' }}>You can view this class, but only {ctx.cls.creator} can approve or reject.</p>}
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      <div className="rv-filters">
        <div className="seg" role="group" aria-label="Show submissions" style={{ flex: '1 1 24rem', maxWidth: '34rem' }}>
          {TABS.map(([k, label]) => <button type="button" key={k} className={tab === k ? 'on' : ''} aria-pressed={tab === k} onClick={() => setTab(k)}>{label} ({counts[k] || 0})</button>)}
        </div>
        {titles.length > 1 && <div className="filters"><label className="label" htmlFor="rv-m">Mission</label><select id="rv-m" value={mission} onChange={e => setMission(e.target.value)}><option value="">All missions</option>{titles.map(t => <option key={t}>{t}</option>)}</select></div>}
      </div>
      {ctx.classId && !subs && !err && <Loading />}
      <p className="muted" role="status" aria-live="polite">{subs ? (shown.length ? '' : tab === 'pending' ? (subs.length ? 'Nothing is waiting for review. Nice work!' : 'No submissions yet.') : 'Nothing to show here.') : ''}</p>
      <div className="rv-grid">{shown.map(s => <Card key={s.id} s={s} owner={owner} onReview={review} onZoom={setBig} />)}</div>
      {big && <Big s={big} onClose={() => setBig(null)} />}
      <Doubts classId={ctx.classId} owner={owner} />
    </>
  );
}
