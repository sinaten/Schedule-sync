'use client';
import { useEffect, useState } from 'react';
import WxIcon from './WxIcon';
import { hourLevel } from './wxLevel';

// The weather row of the action plan: labelled rows (hour, icon, temperature, sure %, date), every cell in its level colour, and it scrolls sideways.
// - No dates on the plan: from this hour on, as far as the forecast goes.
// - The plan includes today: from this hour to its end date.
// - The plan is in the future or in the past: from 12 am of its start date to its end date (the past is real weather, 100% sure).
// Where there is no data (too far ahead or back) a thin line says so.
const cache = {};
const hr = (h) => (h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : h - 12 + 'p');
const LABW = 36;
const CELLW = 40;
const BG = '#eef8f0';
const z = (x) => String(x).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
const getJ = (url) => {
  if (cache[url] && Date.now() - cache[url].t < 600000) return Promise.resolve(cache[url].j);
  return fetch(url, { cache: 'no-store' }).then((r) => r.json()).then((j) => { cache[url] = { t: Date.now(), j }; return j; });
};

export default function WeatherStrip({ job, start = '', end = '' }) {
  const base = '/api/issue?weather=1&job=' + encodeURIComponent(job);
  const [w, setW] = useState(cache[base] && Date.now() - cache[base].t < 600000 ? cache[base].j : null);
  const [rg, setRg] = useState(null);
  const today = ymd(new Date());
  const s0 = start || (end ? today : '');
  const e0 = end || start || '';
  const ranged = !!s0;
  const from = s0 && s0 < today && e0 >= today ? today : s0;
  useEffect(() => { getJ(base).then(setW).catch(() => {}); }, [job]);
  useEffect(() => {
    if (!ranged) { setRg(null); return; }
    let live = true;
    setRg(null);
    getJ(base + '&from=' + from + '&to=' + e0).then((j) => { if (live) setRg(j); }).catch(() => { if (live) setRg({ hours: [] }); });
    return () => { live = false; };
  }, [job, from, e0, ranged]);
  if (!w || !w.days || !w.days.length) return null;
  if (ranged && !rg) return null;
  const now = new Date();
  const d0 = w.days[0];
  // all hours we know: the range (Open-Meteo) first, then the main forecast (National Weather Service) over it
  const all = {};
  for (const h of (ranged ? rg.hours : []) || []) all[h.t] = h;
  for (const h of w.hours || []) all[h.t] = h;
  const keys = Object.keys(all).sort();
  const winStart = !ranged || (s0 <= today && e0 >= today) ? ymd(now) + 'T' + z(now.getHours()) + ':00' : s0 + 'T00:00';
  const winEnd = ranged ? e0 + 'T23:59' : '9999';
  let cells = keys.filter((k) => k >= winStart && k <= winEnd).map((k) => all[k]).filter((_, i) => i % 2 === 0);
  // The bad hours of the whole period (not only the cells in view), grouped by day: tomorrow's bad weather shows even when today is fine.
  // Nothing bad = no line at all. Each day: its date (colour = the day's worst level), then its bad hour ranges, each in its own level colour.
  const alOf = (h) => (new Date(h.t) >= now ? w.alerts : []);
  const inWin = keys.filter((k) => k >= winStart && k <= winEnd).map((k) => all[k]);
  const byDay = {};
  for (const h of inWin) {
    const l = hourLevel(h, alOf(h));
    if (l.n < 2) continue;
    (byDay[h.t.slice(0, 10)] ||= []).push({ n: Number(h.t.slice(11, 13)), l });
  }
  const bad = Object.keys(byDay).sort().map((d) => {
    const rs = [];
    for (const x of byDay[d]) { const r = rs[rs.length - 1]; if (r && r.l.n === x.l.n && x.n === r.b + 1) r.b = x.n; else rs.push({ a: x.n, b: x.n, l: x.l }); }
    return { d, rs, top: rs.reduce((m, r) => (r.l.n > m.n ? r.l : m), rs[0].l) };
  });
  const top = bad.reduce((m, x) => (x.top.n > m.n ? x.top : m), { n: 0 });
  const dd = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const banner = bad.length ? (
    <div style={{ borderLeft: '3px solid ' + top.c, background: 'rgba(255,255,255,.55)', padding: '4px 8px', margin: '4px 4px 4px 2px', lineHeight: 1.3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: top.c, marginBottom: 2 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={top.c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.5" /></svg>
        {'Check weather: ' + top.t}
      </div>
      <div style={{ fontSize: 10.5, lineHeight: 1.65 }}>
        {bad.map((x, i) => (
          <span key={x.d}>
            {i > 0 && <span style={{ color: '#b9b6a8' }}>{' | '}</span>}
            <span style={{ color: x.top.c }}>{dd(x.d) + ':'}</span>{' '}
            {x.rs.map((r, j) => <span key={j}>{j > 0 && ', '}<span style={{ color: r.l.c }}>{r.a === r.b ? hr(r.a) : hr(r.a) + '-' + hr(r.b)}</span></span>)}
          </span>
        ))}
      </div>
    </div>
  ) : null;
  const lastAsked = ranged ? e0 + 'T23:00' : '';
  const missing = ranged && (cells.length === 0 || cells[cells.length - 1].t.slice(0, 13) < lastAsked.slice(0, 13) && (new Date(lastAsked) - new Date(cells[cells.length - 1].t)) / 3600000 > 2);
  // Rough confidence by how far ahead it is (an estimate by lead time, not an official figure); what already happened is 100%.
  const sure = (h) => { const hrs = (new Date(h.t) - now) / 3600000; return hrs <= 0 ? 100 : hrs <= 24 ? 95 : hrs <= 48 ? 90 : hrs <= 72 ? 85 : hrs <= 120 ? 75 : hrs <= 168 ? 65 : hrs <= 240 ? 50 : 40; };
  const dt = (h) => new Date(h.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const RH = { hour: 12, icon: 17, temp: 12, sure: 12, date: 12 };
  const lab = { fontSize: 8.5, color: '#9a9686', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center' };
  if (cells.length === 0) return <div style={{ margin: '6px 4px', fontSize: 10.5, color: '#9a9686', borderTop: '0.5px solid #d9dfd9', paddingTop: 4 }}>No forecast for these dates yet.</div>;
  return (
    <>
    {banner}
    <div title={(d0.why || []).join(', ')} style={{ margin: '4px 0 6px', padding: '2px 4px 2px 2px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', width: 'max-content', minWidth: '100%' }}>
        <div style={{ width: LABW, flex: 'none', display: 'flex', flexDirection: 'column', position: 'sticky', left: 0, background: BG, zIndex: 1 }}>
          <span style={{ ...lab, height: RH.hour }}>Hour</span>
          <span style={{ height: RH.icon }} />
          <span style={{ ...lab, height: RH.temp }}>Temp °F</span>
          <span style={{ ...lab, height: RH.sure }}>Sure %</span>
          <span style={{ ...lab, height: RH.date }}>Date</span>
        </div>
        {cells.map((h) => {
          const lc = hourLevel(h, new Date(h.t) >= now ? w.alerts : []).c;
          const c = { display: 'flex', alignItems: 'center', justifyContent: 'center', color: lc, whiteSpace: 'nowrap' };
          return (
            <span key={h.t} style={{ display: 'flex', flexDirection: 'column', flex: '0 0 ' + CELLW + 'px', borderLeft: '0.5px solid #d9dfd9' }}>
              <span style={{ ...c, height: RH.hour, fontSize: 9 }}>{hr(Number(h.t.slice(11, 13)))}</span>
              <span style={{ ...c, height: RH.icon }}><WxIcon code={h.code} night={!!h.night} size={15} color={lc} /></span>
              <span style={{ ...c, height: RH.temp, fontSize: 9.5, fontWeight: 700 }}>{h.temp}{'°'}</span>
              <span style={{ ...c, height: RH.sure, fontSize: 9 }}>{sure(h)}{'%'}</span>
              <span style={{ ...c, height: RH.date, fontSize: 9.5 }}>{dt(h)}</span>
            </span>
          );
        })}
        {missing && <span style={{ flex: 'none', display: 'flex', alignItems: 'center', borderLeft: '0.5px dashed #b9c2b9', marginLeft: 2, paddingLeft: 6, fontSize: 9, color: '#9a9686', whiteSpace: 'nowrap' }}>no forecast after {dt(cells[cells.length - 1])}</span>}
      </div>
    </div>
    </>
  );
}
