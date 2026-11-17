'use client';
import { useEffect, useState } from 'react';
import ICONS from './mcIcons';

// Header weather: a framed row of capsules (hour, coloured icon, temperature) for the coming hours of the work day.
// The size follows the screen: small on a phone, larger on a tablet, larger still on a desktop.
const cache = {};
const hr = (h) => (h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : h - 12 + 'p');
const LV = { ok: '#2e9e5b', caution: '#e0a31a', no: '#d4483b' };

function pick(code, n) {
  const day = n >= 6 && n < 20;
  if (code >= 95) return 'thunderstorms';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 80 || (code >= 61 && code <= 67)) return 'rain';
  if (code >= 51) return 'drizzle';
  if (code >= 45) return 'fog';
  if (code === 3) return 'cloudy';
  if (code >= 1) return day ? 'partly-cloudy-day' : 'partly-cloudy-night';
  return day ? 'clear-day' : 'clear-night';
}
// green: dry; yellow: some chance of rain, fog or wind; red: rain, storm, snow
function level(h) {
  if (h.code >= 95 || h.code >= 61 || h.prob >= 60) return 'no';
  if (h.code >= 45 || h.prob >= 30) return 'caution';
  return 'ok';
}

export default function WeatherCapsules({ job }) {
  const [w, setW] = useState(cache[job] && Date.now() - cache[job].t < 600000 ? cache[job].j : null);
  useEffect(() => {
    if (w) return;
    fetch('/api/issue?weather=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { cache[job] = { t: Date.now(), j }; setW(j); }).catch(() => {});
  }, [job]);
  if (!w || !w.days || !w.days.length) return null;
  const hours = w.hours || [];
  const hh = (h) => Number(h.t.slice(11, 13));
  const nowH = new Date().getHours();
  const nextDay = (d) => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + 1); return t.toISOString().slice(0, 10); };
  const d0 = w.days[0];
  const all = [...hours.filter((h) => h.t.slice(0, 10) === d0.date && hh(h) % 2 === 0), ...hours.filter((h) => h.t.slice(0, 10) === nextDay(d0.date))].filter((h) => hh(h) % 2 === 0);
  let cells = all.filter((h) => h.t.slice(0, 10) !== d0.date || hh(h) >= nowH - 1).slice(0, 8);
  if (cells.length < 2) cells = hours.filter((h) => hh(h) % 2 === 0).slice(0, 8);
  if (!cells.length) return null;
  const alert = (w.alerts || []).length > 0;
  return (
    <div className="wxcap" title={alert ? 'Official weather warning' : (d0.why || []).join(', ')}>
      <style>{`
        .wxcap{--ic:26px;--t1:9px;--t2:10.5px;--pad:3px 6px 4px;display:flex;gap:4px;align-items:stretch;border:1px solid #bfe0c8;background:rgba(46,158,91,.07);border-radius:15px;padding:4px;flex:none;max-width:100%;overflow:hidden}
        .wxcap .cap{display:flex;flex-direction:column;align-items:center;border-radius:11px;padding:var(--pad);background:#fff;border-bottom:2.5px solid #2e9e5b;line-height:1.15}
        .wxcap .cap i{display:block;width:var(--ic);height:var(--ic);font-style:normal}
        .wxcap .cap span:first-child{font-size:var(--t1);color:#8a8576}
        .wxcap .cap b{font-size:var(--t2);font-weight:600;color:#141413}
        .wxcap .cap:nth-child(n+5){display:none}
        @media (min-width:700px){.wxcap{--ic:34px;--t1:10.5px;--t2:12.5px;--pad:4px 8px 5px;gap:5px;border-radius:17px}.wxcap .cap:nth-child(n+5){display:flex}.wxcap .cap:nth-child(n+7){display:none}}
        @media (min-width:1100px){.wxcap{--ic:38px;--t1:11px;--t2:13px}.wxcap .cap:nth-child(n+7){display:flex}}
      `}</style>
      {cells.map((h) => {
        const n = hh(h);
        const lv = alert ? 'no' : level(h);
        return (
          <div key={h.t} className="cap" style={{ borderBottomColor: LV[lv] }}>
            <span>{hr(n)}</span>
            <i dangerouslySetInnerHTML={{ __html: ICONS[pick(h.code, n)] }} />
            <b>{h.temp}{'°'}</b>
          </div>
        );
      })}
    </div>
  );
}
