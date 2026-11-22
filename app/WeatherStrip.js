'use client';
import { useEffect, useRef, useState } from 'react';
import WxIcon from './WxIcon';
import { hourLevel } from './wxLevel';

// A very thin row for the action plan: the coming hours of the day as small weather icons, to check at a glance.
const cache = {};
const hr = (h) => (h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : h - 12 + 'p');
const LABW = 36;

export default function WeatherStrip({ job }) {
  const [w, setW] = useState(cache[job] && Date.now() - cache[job].t < 600000 ? cache[job].j : null);
  const box = useRef(null);
  const [fit, setFit] = useState(8);
  useEffect(() => {
    const f = () => { const el = box.current; if (!el) return; setFit(Math.max(2, Math.floor((el.clientWidth - 8 - LABW) / 38))); }; // each cell needs about 36 px; the cells then stretch to fill the whole row
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
  // Rough confidence of a forecast by how far ahead it is. This is an estimate by lead time, not an official figure.
  const sure = (h) => { const hrs = (new Date(h.t) - now) / 3600000; return hrs <= 24 ? 95 : hrs <= 48 ? 90 : hrs <= 72 ? 85 : hrs <= 120 ? 75 : hrs <= 168 ? 65 : 50; };
  const dt = (h) => new Date(h.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const RH = { hour: 12, icon: 17, temp: 12, sure: 12, date: 12 };
  const lab = { fontSize: 8.5, color: '#9a9686', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center' };
  return (
    <div ref={box} title={(d0.why || []).join(', ')} style={{ display: 'flex', alignItems: 'stretch', margin: '4px 0 6px', padding: '2px 4px 2px 2px', overflow: 'hidden' }}>
      <div style={{ width: LABW, flex: 'none', display: 'flex', flexDirection: 'column' }}>
        <span style={{ ...lab, height: RH.hour }}>Hour</span>
        <span style={{ height: RH.icon }} />
        <span style={{ ...lab, height: RH.temp }}>Temp °F</span>
        <span style={{ ...lab, height: RH.sure }}>Sure %</span>
        <span style={{ ...lab, height: RH.date }}>Date</span>
      </div>
      {cells.length === 0 ? <span style={{ fontSize: 10.5, color: '#9a9686', alignSelf: 'center' }}><WxIcon code={d0.code} size={15} /> {d0.hi}{'°'}F</span> : cells.map((h) => {
        const n = hh(h);
        const lc = hourLevel(h, w.alerts).c;
        const c = { display: 'flex', alignItems: 'center', justifyContent: 'center', color: lc, whiteSpace: 'nowrap' };
        return (
          <span key={h.t} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 0', borderLeft: '0.5px solid #e3e6e3' }}>
            <span style={{ ...c, height: RH.hour, fontSize: 9 }}>{hr(n)}</span>
            <span style={{ ...c, height: RH.icon }}><WxIcon code={h.code} night={!!h.night} size={15} color={lc} /></span>
            <span style={{ ...c, height: RH.temp, fontSize: 9.5, fontWeight: 700 }}>{h.temp}{'°'}</span>
            <span style={{ ...c, height: RH.sure, fontSize: 9 }}>{sure(h)}{'%'}</span>
            <span style={{ ...c, height: RH.date, fontSize: 9.5 }}>{dt(h)}</span>
          </span>
        );
      })}
    </div>
  );
}
