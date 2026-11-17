'use client';
import { useEffect, useState } from 'react';
import WxIcon from './WxIcon';

// A very thin row for the action plan: the coming hours of the day as small weather icons, to check at a glance.
const cache = {};
const hr = (h) => (h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : h - 12 + 'p');
const DOT = { ok: '#2e9e5b', caution: '#e0a21a', no: '#c0392b' };

export default function WeatherStrip({ job, big }) {
  const [w, setW] = useState(cache[job] && Date.now() - cache[job].t < 600000 ? cache[job].j : null);
  useEffect(() => {
    if (w) return;
    fetch('/api/issue?weather=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { cache[job] = { t: Date.now(), j }; setW(j); }).catch(() => {});
  }, [job]);
  if (!w || !w.days || !w.days.length) return null;
  const hours = w.hours || [];
  const now = new Date();
  const hh = (h) => Number(h.t.slice(11, 13));
  const nextDay = (d) => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + 1); return t.toISOString().slice(0, 10); };
  // the work day is 24 hours: the rest of today every two hours, up to midnight
  const dayCells = (d) => [...hours.filter((h) => h.t.slice(0, 10) === d && hh(h) % 2 === 0), ...hours.filter((h) => h.t.slice(0, 10) === nextDay(d) && hh(h) === 0)];
  let d0 = w.days[0], cells = dayCells(d0.date);
  const nowH = now.getHours();
  const upcoming = cells.filter((h) => h.t.slice(0, 10) !== d0.date || hh(h) >= nowH - 1);
  if (upcoming.length >= 2) cells = upcoming;
  else if (w.days[1]) { d0 = w.days[1]; cells = dayCells(d0.date); }
  const lv = (w.alerts || []).length ? 'no' : d0.level;
  return (
    <div title={d0.why.join(', ')} style={big ? { display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 8, margin: '6px 0 10px', padding: '6px 14px', minHeight: '28vh' } : { display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 6px', padding: '2px 4px', overflowX: 'auto' }}>
      <span style={{ width: big ? 12 : 8, height: big ? 12 : 8, borderRadius: 6, background: DOT[lv], flex: 'none' }} />
      {cells.length === 0 ? <span style={{ fontSize: 10.5, color: '#9a9686' }}><WxIcon code={d0.code} size={15} /> {d0.hi}{'°'}F</span> : cells.map((h) => {
        const n = hh(h);
        return (
          <span key={h.t} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: big ? 44 : 28, lineHeight: big ? 1.5 : 1.05, flex: 'none', gap: big ? 4 : 0 }}>
            <span style={{ fontSize: big ? 13 : 9, color: '#9a9686' }}>{hr(n)}</span>
            <WxIcon code={h.code} size={big ? 30 : 15} color={h.prob >= 50 ? '#c0392b' : '#6b675c'} />
            <span style={{ fontSize: big ? 15 : 9.5, color: h.prob >= 50 ? '#c0392b' : '#6b675c', fontWeight: h.prob >= 50 ? 700 : 400 }}>{h.temp}{'°'}</span>
          </span>
        );
      })}
    </div>
  );
}
