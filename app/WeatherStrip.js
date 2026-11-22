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
  const lastAsked = ranged ? e0 + 'T23:00' : '';
  const missing = ranged && (cells.length === 0 || cells[cells.length - 1].t.slice(0, 13) < lastAsked.slice(0, 13) && (new Date(lastAsked) - new Date(cells[cells.length - 1].t)) / 3600000 > 2);
  // Rough confidence by how far ahead it is (an estimate by lead time, not an official figure); what already happened is 100%.
  const sure = (h) => { const hrs = (new Date(h.t) - now) / 3600000; return hrs <= 0 ? 100 : hrs <= 24 ? 95 : hrs <= 48 ? 90 : hrs <= 72 ? 85 : hrs <= 120 ? 75 : hrs <= 168 ? 65 : hrs <= 240 ? 50 : 40; };
  const dt = (h) => new Date(h.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const RH = { hour: 12, icon: 17, temp: 12, sure: 12, date: 12 };
  const lab = { fontSize: 8.5, color: '#9a9686', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center' };
  if (cells.length === 0) return <div style={{ margin: '6px 4px', fontSize: 10.5, color: '#9a9686', borderTop: '0.5px solid #d9dfd9', paddingTop: 4 }}>No forecast for these dates yet.</div>;
  return (
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
  );
}
