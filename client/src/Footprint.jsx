import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon, Loading, useToast } from './ui';
import { AreaChart, BarChart } from './charts';
import './footprint.css';

// grams -> "850 g" or "1.2 kg"
const fmt = g => { g = Number(g) || 0; return g < 1000 ? `${g} g` : `${(g / 1000).toFixed(1).replace(/\.0$/, '')} kg`; };

export default function Footprint() {
  const toast = useToast();
  const [d, setD] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState('');
  const load = () => api('/footprint').then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (err && !d) return <p className="alert" role="alert">{err}</p>;
  if (!d) return <Loading />;

  const tap = async a => {
    if (busy) return; setBusy(a.id); setErr('');
    const done = d.today.includes(a.id);
    try {
      if (done) { await api(`/footprint/log/${a.id}`, { method: 'DELETE' }); toast('Removed from today'); }
      else { await api('/footprint/log', { method: 'POST', body: { action: a.id } }); toast(`Logged! About ${fmt(a.grams)} of CO₂ saved`); }
      await load();
    } catch (e) { setErr(e.message); }
    setBusy('');
  };
  const todayG = d.actions.filter(a => d.today.includes(a.id)).reduce((s, a) => s + a.grams, 0);
  const chart = d.days.map((day, i) => ({ day, grams: d.series[i] }));
  const label = Object.fromEntries(d.actions.map(a => [a.id, a]));
  const top = [...d.by_action].sort((a, b) => b.grams - a.grams).slice(0, 5);
  return (
    <>
      <header className="page-head"><div><h1>Eco footprint</h1><p className="muted">Tap what you did today. Each action can be logged once a day. The CO₂ numbers are rough estimates, not exact measurements.</p></div></header>
      {err && <p className="alert" role="alert"><Icon name="alert" size={18} /> {err}</p>}
      <section className="card fp-stats">
        <div className="stat"><span className="label">Total CO₂ saved (about)</span><div className="big">{fmt(d.total_grams)}</div></div>
        <div className="stat"><span className="label">Saved today (about)</span><div className="big">{fmt(todayG)}</div></div>
        <div className="stat"><span className="label">Actions logged</span><div className="big">{Number(d.total_logs)}</div></div>
      </section>
      <section className="card paper">
        <h2>Today</h2><p className="muted">What did you do for the planet today?</p>
        <ul className="fp-grid">
          {d.actions.map(a => {
            const on = d.today.includes(a.id);
            return (
              <li key={a.id}>
                <button type="button" className={'fp-act' + (on ? ' on' : '')} aria-pressed={on} disabled={!!busy} onClick={() => tap(a)}>
                  <span className="fp-ico" aria-hidden="true">{a.icon}</span>
                  <span className="fp-txt"><b>{a.label}</b><small>About {fmt(a.grams)} CO₂</small></span>
                  <span className="fp-state">{on ? <><Icon name="check" size={16} /> Logged</> : 'Tap to log'}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="muted" style={{ marginTop: '.75rem' }}>Tapped by mistake? Tap a logged action again to undo it.</p>
      </section>
      <div className="grid-2">
        <section className="card"><h2>Last 7 days</h2><p className="muted">Estimated CO₂ saved per day, in grams</p>
          <div style={{ marginTop: '.9rem' }}><AreaChart data={chart} yKey="grams" unit="g CO₂" label="Estimated CO2 saved per day" /></div></section>
        <section className="card"><h2>Your top actions</h2><p className="muted">Where most of your savings come from</p>
          {top.length ? <div style={{ marginTop: '.9rem' }}><BarChart label="CO2 saved by action" unit=" g" rows={top.map(t => ({ label: `${label[t.id].icon} ${label[t.id].label}`, value: t.grams, color: '#d6ff00' }))} /></div>
            : <p className="muted" style={{ marginTop: '.9rem' }}>Log your first action above and it shows up here.</p>}</section>
      </div>
    </>
  );
}
