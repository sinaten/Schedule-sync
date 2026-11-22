'use client';
import { useEffect, useRef, useState } from 'react';
import WxIcon from './WxIcon';

// A very thin row for the action plan: the coming hours of the day as small weather icons, to check at a glance.
const cache = {};
const hr = (h) => (h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : h - 12 + 'p');
const DOT = { ok: '#2e9e5b', caution: '#e0a21a', no: '#c0392b' };

export default function WeatherStrip({ job }) {
  const [w, setW] = useState(cache[job] && Date.now() - cache[job].t < 600000 ? cache[job].j : null);
  const box = useRef(null);
  const [fit, setFit] = useState(8);
  useEffect(() => {
    const f = () => { const el = box.current; if (!el) return; setFit(Math.max(2, Math.floor((el.clientWidth - 8 - 14 + 6) / (36 + 6)))); }; // each cell needs about 36 px; the cells then stretch to fill the whole row
    f(); window.addEventListener('resize', f);
    const ro = typeof ResizeObserver !== 'undefined' && box.current ? new ResizeObserver(f) : null;
    if (ro) ro.observe(box.current);
    return () => { window.removeEventListener('resize', f); if (ro) ro.disconnect(); };
  }, [w]);
  useEffect(() => {
    if (w) return;
    fetch('/api/issue?weather=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { cache[job] = { t: Date.now(), j }; setW(j); }).catch(() => {});
  }, [job]);
  if (!w || !w.days || !w.days.length) return null;
  const hours = w.hours || [];
  const now = new Date();
  const hh = (h) => Number(h.t.slice(11, 13));
  // from the hour we are in (5:58 pm still starts at 5p), every two hours, as many as fit the row
  const z = (x) => String(x).padStart(2, '0');
  const local = now.getFullYear() + '-' + z(now.getMonth() + 1) + '-' + z(now.getDate()) + 'T' + z(now.getHours());
  const d0 = w.days[0];
  let cells = hours.filter((h) => h.t.slice(0, 13) >= local);
  if (!cells.length) cells = hours;
  cells = cells.filter((_, i) => i % 2 === 0).slice(0, fit);
  const lv = (w.alerts || []).length ? 'no' : d0.level;
  return (
    <div ref={box} title={(d0.why || []).join(', ')} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 6px', padding: '2px 4px', overflow: 'hidden' }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: DOT[lv], flex: 'none' }} />
      {cells.length === 0 ? <span style={{ fontSize: 10.5, color: '#9a9686' }}><WxIcon code={d0.code} size={15} /> {d0.hi}{'°'}F</span> : cells.map((h) => {
        const n = hh(h);
        return (
          <span key={h.t} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, lineHeight: 1.05, flex: '1 1 0' }}>
            <span style={{ fontSize: 9, color: '#9a9686' }}>{hr(n)}</span>
            <WxIcon code={h.code} night={!!h.night} size={15} color={h.prob >= 50 ? '#c0392b' : '#6b675c'} />
            <span style={{ fontSize: 9.5, color: h.prob >= 50 ? '#c0392b' : '#6b675c', fontWeight: h.prob >= 50 ? 700 : 400 }}>{h.temp}{'°'}</span>
          </span>
        );
      })}
    </div>
  );
}
