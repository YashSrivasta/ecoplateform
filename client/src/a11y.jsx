// Accessibility tools: adjustable text size + read aloud (browser speech synthesis, no outside service).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './ui';

const SIZES = [90, 100, 115, 130, 150]; // percent of the browser's own text size
const A11yCtx = createContext(null);
export const useA11y = () => useContext(A11yCtx);

const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export function A11yProvider({ children }) {
  const [size, setSize] = useState(() => { const n = +read('eq-text'); return SIZES.includes(n) ? n : 100; });
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const run = useRef(0);

  useEffect(() => { document.documentElement.style.fontSize = size + '%'; write('eq-text', String(size)); }, [size]);
  const bigger = () => setSize(s => SIZES[Math.min(SIZES.indexOf(s) + 1, SIZES.length - 1)]);
  const smaller = () => setSize(s => SIZES[Math.max(SIZES.indexOf(s) - 1, 0)]);

  const stop = useCallback(() => { run.current++; if (supported) window.speechSynthesis.cancel(); setSpeaking(false); }, [supported]);
  const speak = useCallback(text => {
    if (!supported) return;
    stop();
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const parts = clean.match(/[^.!?\n]+[.!?]*\s*/g) || [clean]; // short pieces: long ones get cut off in some browsers
    const chunks = []; let cur = '';
    for (const p of parts) { if ((cur + p).length > 180 && cur) { chunks.push(cur); cur = p; } else cur += p; }
    if (cur) chunks.push(cur);
    const id = ++run.current; setSpeaking(true);
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      u.lang = document.documentElement.lang || 'en'; u.rate = 0.95;
      const done = () => { if (run.current === id && i === chunks.length - 1) setSpeaking(false); };
      u.onend = done; u.onerror = done;
      window.speechSynthesis.speak(u);
    });
  }, [supported, stop]);
  useEffect(() => stop, [stop]);

  const value = useMemo(() => ({ size, SIZES, bigger, smaller, reset: () => setSize(100), speak, stop, speaking, supported }), [size, speak, stop, speaking, supported]);
  return <A11yCtx.Provider value={value}>{children}</A11yCtx.Provider>;
}

/** Toolbar: text size and read aloud. Reads the selected text, or the whole main area if nothing is selected. */
export function A11yBar({ target = '#main' }) {
  const a = useA11y();
  const onRead = () => {
    if (a.speaking) return a.stop();
    const sel = window.getSelection()?.toString().trim();
    a.speak(sel || document.querySelector(target)?.innerText || document.body.innerText);
  };
  return (
    <div className="a11y no-print" role="group" aria-label="Accessibility tools">
      <button type="button" className="btn btn-line" onClick={a.smaller} disabled={a.size === a.SIZES[0]} aria-label="Make text smaller">A<small>−</small></button>
      <span className="a11y-size" aria-live="polite">{a.size}%</span>
      <button type="button" className="btn btn-line" onClick={a.bigger} disabled={a.size === a.SIZES[a.SIZES.length - 1]} aria-label="Make text bigger">A<small>+</small></button>
      {a.size !== 100 && <button type="button" className="link" onClick={a.reset}>Reset</button>}
      {a.supported && (
        <button type="button" className="btn btn-line" onClick={onRead} aria-pressed={a.speaking}>
          <Icon name="sound" size={18} />{a.speaking ? 'Stop reading' : 'Read aloud'}
        </button>
      )}
    </div>
  );
}

/** Small speaker button for one card or paragraph: <ReadButton text="..." /> */
export function ReadButton({ text, label = 'Read this aloud' }) {
  const a = useA11y();
  if (!a?.supported) return null;
  return <button type="button" className="btn btn-line icon-btn no-print" aria-label={label} title={label} onClick={() => a.speak(text)}><Icon name="sound" size={18} /></button>;
}
