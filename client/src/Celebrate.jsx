import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import './celebrate.css';

const Ctx = createContext(() => {});
/** const celebrate = useCelebrate(); celebrate(newBadges)  where newBadges = [{name, icon, at}] from an answer response. */
export const useCelebrate = () => useContext(Ctx);

const COLORS = ['#d6ff00', '#4da3ff', '#b583ff', '#ff9f43', '#ff6b9d'];
const SPARKS = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2, r = 110 + (i % 3) * 30; return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r * 0.8), c: COLORS[i % COLORS.length] }; });

function Dialog({ badges, onClose }) {
  const btn = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    btn.current?.focus();
    const key = e => { if (e.key === 'Escape') onClose(); if (e.key === 'Tab') { e.preventDefault(); btn.current?.focus(); } }; // one button: keep focus inside
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, []);
  const many = badges.length > 1;
  return (
    <div className="cel-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cel" role="dialog" aria-modal="true" aria-labelledby="cel-title" aria-describedby="cel-desc">
        {SPARKS.map((s, i) => <span key={i} className="spark" aria-hidden="true" style={{ '--x': s.x + 'px', '--y': s.y + 'px', '--c': s.c }} />)}
        <div className="cel-badges">
          {badges.map(b => <div className="cel-badge" key={b.name}><span className="em" aria-hidden="true">{b.icon}</span>{b.name}<small>{b.at} points</small></div>)}
        </div>
        <h2 id="cel-title">{many ? 'New badges unlocked!' : 'Badge unlocked!'}</h2>
        <p id="cel-desc" className="muted">{many ? `You earned ${badges.map(b => b.name).join(' and ')}.` : `You earned the ${badges[0].name} badge. Keep going!`}</p>
        <button ref={btn} type="button" className="btn btn-primary" onClick={onClose}>Awesome!</button>
      </div>
    </div>
  );
}

export function CelebrateProvider({ children }) {
  const [badges, setBadges] = useState(null);
  const celebrate = useCallback(list => { if (list?.length) setBadges(cur => { const seen = new Set((cur || []).map(b => b.name)); return [...(cur || []), ...list.filter(b => !seen.has(b.name))]; }); }, []);
  return <Ctx.Provider value={celebrate}>{children}{badges && <Dialog badges={badges} onClose={() => setBadges(null)} />}</Ctx.Provider>;
}
