'use client';
import { useEffect, useState } from 'react';

// A small weather tab for an action plan: the forecast at the project's saved location and, for each day, whether it is safe to work on outdoor electrical equipment.
const cache = {};
const icon = (c) => (c >= 95 ? '⛈️' : c >= 71 && c <= 77 || c === 85 || c === 86 ? '❄️' : c >= 51 ? '\u{1F327}️' : c >= 45 ? '\u{1F32B}️' : c >= 2 ? '☁️' : c === 1 ? '\u{1F324}️' : '☀️');
const LV = { ok: { c: '#2e7d4a', bg: '#e1f3e6', t: 'OK TO WORK' }, caution: { c: '#a86400', bg: '#fff3dc', t: 'CAUTION' }, no: { c: '#c0392b', bg: '#fdecea', t: 'DO NOT WORK' } };
const day = (d, i) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));

export default function WeatherTab({ job }) {
  const [o, setO] = useState(false);
  const [w, setW] = useState(cache[job] && Date.now() - cache[job].t < 600000 ? cache[job].j : null);
  useEffect(() => {
    if (w) return;
    fetch('/api/issue?weather=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { cache[job] = { t: Date.now(), j }; setW(j); }).catch(() => setW({ error: 1 }));
  }, [job]);
  useEffect(() => { const f = () => { delete cache[job]; setW(null); fetch('/api/issue?weather=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { cache[job] = { t: Date.now(), j }; setW(j); }).catch(() => {}); }; window.addEventListener('ss-weather-reload', f); return () => window.removeEventListener('ss-weather-reload', f); }, [job]);
  const days = (w && w.days) || [];
  const worst = days.slice(0, 2).reduce((m, x) => (x.level === 'no' ? 'no' : x.level === 'caution' && m !== 'no' ? 'caution' : m), 'ok');
  const chip = days.length ? LV[worst] : null;
  return (
    <div style={{ margin: '10px 0', border: '1px solid #cfe9d6', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <button type="button" onClick={() => setO((x) => !x)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 0, background: 'none', padding: '7px 10px', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 18 }}>{'☀️☁️'}</span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Weather{w && w.place ? <span style={{ fontWeight: 400, color: '#6b675c' }}> {'\u00B7'} {w.place}</span> : null}</span>
        {chip && <span style={{ background: chip.bg, color: chip.c, borderRadius: 6, padding: '1px 7px', fontSize: 10.5, fontWeight: 700 }}>{chip.t}</span>}
        <span style={{ color: '#e8710a', fontSize: 12 }}>{o ? '▴' : '▾'}</span>
      </button>
      {o && (
        <div style={{ padding: '2px 10px 10px', fontSize: 12.5 }}>
          {!w && <div style={{ color: '#9a9686', padding: '6px 0' }}>Loading…</div>}
          {w && w.none && <div style={{ color: '#9a9686', padding: '6px 0' }}>No location is saved for this project yet. An admin sets it under Projects.</div>}
          {w && w.error && <div style={{ color: '#9a9686', padding: '6px 0' }}>Could not get the forecast now.</div>}
          {(w && w.alerts || []).map((a, i) => <div key={i} style={{ background: '#fdecea', color: '#a02a1f', borderRadius: 8, padding: '6px 9px', margin: '4px 0', fontSize: 12.5 }}><b>{'\u26A0'} {a.event}</b>{a.ends ? ' until ' + new Date(a.ends).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : ''}<div style={{ fontSize: 11.5, marginTop: 1 }}>{a.headline}</div></div>)}
          {days.map((x, i) => {
            const l = LV[x.level];
            return (
              <div key={x.date} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i ? '1px solid #eef3ef' : 0 }}>
                <span style={{ fontSize: 20, width: 26 }}>{icon(x.code)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{day(x.date, i)} <span style={{ fontWeight: 400, color: '#6b675c' }}>{x.hi}{'°'} / {x.lo}{'°'} F {'·'} rain {x.prob}% {'·'} gusts {x.gust} mph</span></div>
                  {x.level !== 'ok' && <div style={{ color: l.c, marginTop: 1 }}>{x.level === 'no' ? 'Outdoor electrical panels: do not work in ' : 'Be careful: '}{x.why.join(', ')}.</div>}
                </div>
                <span style={{ background: l.bg, color: l.c, borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{l.t}</span>
              </div>
            );
          })}
          {days.length > 0 && <div style={{ color: '#9a9686', fontSize: 11, marginTop: 4 }}>Source: {w.source || 'forecast'}. Rain, snow or thunderstorm: no work on outdoor electrical panels.</div>}
        </div>
      )}
    </div>
  );
}
