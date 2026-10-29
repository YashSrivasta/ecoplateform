// Small SVG charts, no libraries. Every chart has a "View as table" fallback, and meaning never depends on colour alone.
import { useState } from 'react';

const DASH = ['', '7 4', '2 4', '9 3 2 3', '1 5'];
const dayLabel = d => { const t = new Date(d + 'T00:00:00'); return isNaN(t) ? String(d) : t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
const nice = m => { const raw = Math.max(m, 4) / 4; const p = 10 ** Math.floor(Math.log10(raw)); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p * 4; }; // 4 even steps, so axis labels are whole numbers

function Table({ head, rows }) {
  return (
    <details className="table-view"><summary>View as table</summary>
      <div className="scroll"><table><thead><tr>{head.map((h, i) => <th key={h} className={i ? 'num' : ''}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : ''}>{c}</td>)}</tr>)}</tbody></table></div>
    </details>
  );
}

const W = 640, M = { l: 38, r: 16, t: 14, b: 28 };
function frame(height, max, n, labelOf) {
  const iw = W - M.l - M.r, ih = height - M.t - M.b;
  const x = i => M.l + (n < 2 ? iw / 2 : (i * iw) / (n - 1));
  const y = v => M.t + ih - (v / max) * ih;
  const step = Math.max(1, Math.ceil(n / 6));
  const grid = [0, 1, 2, 3, 4].map(k => { const v = (max * k) / 4; return <g key={k}><line className="ch-grid" x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} /><text className="ch-tick" x={M.l - 8} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text></g>; });
  const xs = Array.from({ length: n }, (_, i) => i).filter(i => i === n - 1 || (i % step === 0 && n - 1 - i >= step)).map(i => <text key={i} className="ch-tick" x={x(i)} y={height - 8} textAnchor="middle">{labelOf(i)}</text>);
  return { x, y, grid, xs };
}

/** One series over time. data = [{day, points}] (keys can be changed with xKey / yKey). */
export function AreaChart({ data, xKey = 'day', yKey = 'points', unit = 'points', label = 'Points per day', height = 230 }) {
  const [on, setOn] = useState(null);
  if (!data?.length) return <p className="muted">Nothing to show yet.</p>;
  const max = nice(Math.max(...data.map(d => d[yKey] || 0)));
  const f = frame(height, max, data.length, i => dayLabel(data[i][xKey]));
  const pts = data.map((d, i) => [f.x(i), f.y(d[yKey] || 0)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const base = f.y(0);
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${base} L${pts[0][0].toFixed(1)} ${base} Z`;
  const a = on === null ? null : data[on];
  const tx = on === null ? 0 : Math.min(Math.max(pts[on][0] - 62, 4), W - 128);
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="group" aria-label={label}>
        <defs><linearGradient id="eqArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--lime)" stopOpacity=".28" /><stop offset="100%" stopColor="var(--lime)" stopOpacity="0" /></linearGradient></defs>
        {f.grid}{f.xs}
        <path d={area} fill="url(#eqArea)" /><path d={line} className="ch-line" />
        {pts.map((p, i) => (
          <circle key={i} className="ch-dot" cx={p[0]} cy={p[1]} r={on === i ? 7 : 4.5} tabIndex={0}
            aria-label={`${dayLabel(data[i][xKey])}: ${data[i][yKey] || 0} ${unit}`}
            onMouseEnter={() => setOn(i)} onMouseLeave={() => setOn(null)} onFocus={() => setOn(i)} onBlur={() => setOn(null)} />
        ))}
        {a && <g className="ch-tip" pointerEvents="none"><rect x={tx} y={Math.max(pts[on][1] - 46, 2)} width="124" height="36" rx="10" /><text x={tx + 62} y={Math.max(pts[on][1] - 24, 24)} textAnchor="middle">{dayLabel(a[xKey])} · {a[yKey] || 0} {unit}</text></g>}
      </svg>
      <Table head={['Day', unit[0].toUpperCase() + unit.slice(1)]} rows={data.map(d => [dayLabel(d[xKey]), d[yKey] || 0])} />
    </>
  );
}

/** Several lines over the same days. labels=[day...], series=[{name,color,values[]}]. Lines also differ by dash pattern. */
export function LineChart({ labels, series, label = 'Points over time', unit = 'points', height = 250 }) {
  if (!labels?.length || !series?.length) return <p className="muted">Nothing to show yet.</p>;
  const max = nice(Math.max(1, ...series.flatMap(s => s.values)));
  const f = frame(height, max, labels.length, i => dayLabel(labels[i]));
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${label}. ${series.map(s => `${s.name} ends at ${s.values[s.values.length - 1]}`).join(', ')}.`}>
        {f.grid}{f.xs}
        {series.map((s, k) => {
          const d = s.values.map((v, i) => (i ? 'L' : 'M') + f.x(i).toFixed(1) + ' ' + f.y(v).toFixed(1)).join(' ');
          const last = s.values.length - 1;
          return <g key={s.name}><path d={d} className="ch-multi" style={{ stroke: s.color, strokeDasharray: DASH[k % DASH.length] }} /><circle cx={f.x(last)} cy={f.y(s.values[last])} r="4.5" style={{ fill: s.color }} className="ch-end" /></g>;
        })}
      </svg>
      <ul className="legend">
        {series.map((s, k) => (
          <li key={s.name}>
            <svg width="30" height="10" aria-hidden="true"><line x1="1" x2="29" y1="5" y2="5" strokeWidth="3" strokeLinecap="round" style={{ stroke: s.color, strokeDasharray: DASH[k % DASH.length] }} /></svg>
            {s.name} <b>{s.values[s.values.length - 1]}</b>
          </li>
        ))}
      </ul>
      <Table head={['Day', ...series.map(s => s.name)]} rows={labels.map((d, i) => [dayLabel(d), ...series.map(s => s.values[i])])} />
    </>
  );
}

/** Horizontal bars. rows=[{label, value, color?, note?}]. Values are always written out. */
export function BarChart({ rows, max, unit = '', label = 'Comparison' }) {
  if (!rows?.length) return <p className="muted">Nothing to show yet.</p>;
  const top = max || Math.max(1, ...rows.map(r => r.value));
  return (
    <ul className="bars" aria-label={label}>
      {rows.map(r => (
        <li key={r.label}>
          <span className="bars-label">{r.label}</span>
          <span className="bar" role="img" aria-label={`${r.label}: ${r.value}${unit}`}><i style={{ width: Math.max(0, Math.min(100, (r.value / top) * 100)) + '%', ...(r.color && { background: r.color }) }} /></span>
          <b className="bars-val">{r.value}{unit}</b>
        </li>
      ))}
    </ul>
  );
}

/** Pie / donut. slices=[{label, value, color}]. Share is printed on the slice and in the legend. */
export function Donut({ slices, label = 'Share', center }) {
  const live = (slices || []).filter(s => s.value > 0);
  const total = live.reduce((a, s) => a + s.value, 0);
  if (!total) return <p className="muted">Nothing to show yet.</p>;
  const R = 70, C = 2 * Math.PI * R; let acc = 0;
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 200 200" role="img" aria-label={`${label}. ${live.map(s => `${s.label} ${Math.round((s.value / total) * 100)} percent`).join(', ')}.`}>
        <g transform="rotate(-90 100 100)">
          {live.map(s => { const len = (s.value / total) * C; const el = <circle key={s.label} cx="100" cy="100" r={R} fill="none" strokeWidth="34" strokeDasharray={`${Math.max(len - 2, 0)} ${C - Math.max(len - 2, 0)}`} strokeDashoffset={-acc} style={{ stroke: s.color }} />; acc += len; return el; })}
        </g>
        {(() => { let a = 0; return live.map(s => { const mid = (a + s.value / 2) / total; a += s.value; const p = Math.round((s.value / total) * 100); if (p < 8) return null; const ang = mid * 2 * Math.PI - Math.PI / 2; return <text key={s.label} className="donut-pct" x={100 + R * Math.cos(ang)} y={100 + R * Math.sin(ang) + 4} textAnchor="middle">{p}%</text>; }); })()}
        <text className="donut-mid" x="100" y="100" textAnchor="middle">{center ?? total}</text>
      </svg>
      <ul className="legend col">
        {live.map(s => <li key={s.label}><i className="sw" style={{ background: s.color }} aria-hidden="true" />{s.label} <b>{s.value}</b> <span className="muted">({Math.round((s.value / total) * 100)}%)</span></li>)}
      </ul>
    </div>
  );
}
