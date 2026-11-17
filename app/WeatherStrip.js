'use client';
import { useEffect, useState } from 'react';

// A very thin row for the action plan: the coming hours of the day as small weather icons, to check at a glance.
const cache = {};
const icon = (c) => (c >= 95 ? '⛈️' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? '❄️' : c >= 51 ? '\u{1F327}️' : c >= 45 ? '\u{1F32B}️' : c >= 2 ? '☁️' : c === 1 ? '\u{1F324}️' : '☀️');
const hr = (h) => (h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : h - 12 + 'p');
const DOT = { ok: '#2e9e5b', caution: '#e0a21a', no: '#c0392b' };

export default function WeatherStrip({ job }) {
  const [w, setW] = useState(cache[job] && Date.now() - cache[job].t < 600000 ? cache[job].j : null);
  useEffect(() => {
    if (w) return;
    fetch('/api/issue?weather=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { cache[job] = { t: Date.now(), j }; setW(j); }).catch(() => {});
  }, [job]);
  if (!w || !w.days || !w.days.length) return null;
  const hours = w.hours || [];
  const now = new Date();
  const day = (d) => hours.filter((h) => h.t.slice(0, 10) === d && Number(h.t.slice(11, 13)) >= 6 && Number(h.t.slice(11, 13)) <= 22 && Number(h.t.slice(11, 13)) % 2 === 0);
  let d0 = w.days[0], cells = day(d0.date).filter((h) => h.t.slice(0, 10) !== now.toISOString().slice(0, 10) || true);
  const nowH = now.getHours();
  const upcoming = cells.filter((h) => Number(h.t.slice(11, 13)) >= nowH - 1);
  if (upcoming.length >= 2) cells = upcoming;
  else if (w.days[1]) { d0 = w.days[1]; cells = day(d0.date); }
  const lv = (w.alerts || []).length ? 'no' : d0.level;
  return (
    <div title={d0.why.join(', ')} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 6px', padding: '2px 6px', border: '1px solid #e3efe6', borderRadius: 10, background: '#fff', overflowX: 'auto' }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: DOT[lv], flex: 'none' }} />
      {cells.length === 0 ? <span style={{ fontSize: 10.5, color: '#9a9686' }}>{icon(d0.code)} {d0.hi}{'°'}F</span> : cells.map((h) => {
        const n = Number(h.t.slice(11, 13));
        return (
          <span key={h.t} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: 28, lineHeight: 1.05, flex: 'none' }}>
            <span style={{ fontSize: 9, color: '#9a9686' }}>{hr(n)}</span>
            <span style={{ fontSize: 13 }}>{icon(h.code)}</span>
            <span style={{ fontSize: 9.5, color: h.prob >= 50 ? '#c0392b' : '#6b675c', fontWeight: h.prob >= 50 ? 700 : 400 }}>{h.temp}{'°'}</span>
          </span>
        );
      })}
    </div>
  );
}
