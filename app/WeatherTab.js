'use client';
import { useEffect, useState } from 'react';
import MapPicker from './admin/MapPicker';
import WxIcon from './WxIcon';
import { hourLevel } from './wxLevel';

// The weather tab: closed it shows the six coming days at a glance; open it shows the chosen day hour by hour and the official warnings.
// Without a saved location a tap opens the map instead; the chosen place is saved as the location of the project's HSE.
const cache = {};
const OR = '#e8710a';
const LV = { ok: { c: '#2e7d4a', bg: '#e1f3e6', t: 'OK TO WORK', dot: '#2e9e5b' }, caution: { c: '#a86400', bg: '#fff3dc', t: 'CAUTION', dot: '#e0a21a' }, no: { c: '#c0392b', bg: '#fdecea', t: 'DO NOT WORK', dot: '#c0392b' } };
const sky = (c) => (c >= 95 ? 'Storm' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'Snow' : c >= 51 ? 'Rain' : c >= 45 ? 'Fog' : c >= 3 ? 'Cloudy' : c >= 1 ? 'Partly' : 'Sunny');
const c = (f) => Math.round((f - 32) * 5 / 9);
const dn = (d, i) => (i === 0 ? 'Today' : new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short' }));
const long = (d, i) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }));
const hr = (h) => (h === 0 ? '12 am' : h < 12 ? h + ' am' : h === 12 ? '12 pm' : h - 12 + ' pm');
const PARTS = [['Morning', 5, 11], ['Afternoon', 12, 17], ['Evening', 18, 22]];

export default function WeatherTab({ job, bare, asBar }) {
  const [o, setO] = useState(!!bare);
  const [sel, setSel] = useState(0);
  const [map, setMap] = useState(false);
  const [msg, setMsg] = useState('');
  const [w, setW] = useState(cache[job] && Date.now() - cache[job].t < 600000 ? cache[job].j : null);
  const load = () => fetch('/api/issue?weather=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { cache[job] = { t: Date.now(), j }; setW(j); }).catch(() => setW({ error: 1 }));
  useEffect(() => { if (!w) load(); }, [job]);
  useEffect(() => { const f = () => { delete cache[job]; setW(null); load(); }; window.addEventListener('ss-weather-reload', f); return () => window.removeEventListener('ss-weather-reload', f); }, [job]);
  const days = (w && w.days) || [];
  const alerts = (w && w.alerts) || [];
  const none = !!(w && w.none);
  const x = days[sel] || days[0];
  const hours = ((w && w.hours) || []).filter((h) => x && h.t.slice(0, 10) === x.date);
  const worst = days.slice(0, 2).reduce((m, d) => (d.level === 'no' ? 'no' : d.level === 'caution' && m !== 'no' ? 'caution' : m), 'ok');
  const chip = days.length ? LV[worst] : null;
  const head = () => { if (none) { setMap(true); return; } setO((v) => !v); };
  const saveLoc = async (pos) => {
    let place = '';
    try { const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=' + pos.lat + '&lon=' + pos.lng); const j = await r.json(); const a = j.address || {}; place = [a.city || a.town || a.village || a.county, a.state].filter(Boolean).join(', '); } catch (e) {}
    const r = await fetch('/api/hse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, action: 'profile', data: { lat: pos.lat, lng: pos.lng, place } }) });
    if (!r.ok) { setMsg('Only a manager or an editor can set the location.'); return false; }
    setMsg(''); window.dispatchEvent(new Event('ss-weather-reload')); return true;
  };
  return (
    <div style={asBar ? { border: '1px solid #e7e3d8', borderRadius: 14, background: '#fff', overflow: 'hidden' } : bare ? { margin: '4px 0', background: '#fff' } : { margin: '10px 0', border: '1px solid #cfe9d6', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      {map && <MapPicker title="Location of this project" onClose={() => setMap(false)} onSave={saveLoc} />}
      {(!bare || none) && <div role="button" tabIndex={0} onClick={head} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer' }}>
        {!asBar && <span style={{ fontSize: 18 }}>{'☀️☁️'}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>{asBar ? (w && w.place ? w.place : '') : <>Weather{w && w.place ? <span style={{ fontWeight: 400, color: '#6b675c' }}> {'·'} {w.place}</span> : null}</>}</span>
        {none ? <span style={{ fontSize: 11.5, color: OR, fontWeight: 600 }}>{'\u{1F4CD}'} Set location</span> : chip && (asBar || !o) && (alerts.length ? <span title={alerts.map((a) => a.event).join(', ')} style={{ background: '#fdecea', color: '#c0392b', borderRadius: 6, padding: '1px 7px', fontSize: 10.5, fontWeight: 700, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{'\u26A0'} {alerts[0].event}{alerts.length > 1 ? ' +' + (alerts.length - 1) : ''}</span> : <span style={{ background: chip.bg, color: chip.c, borderRadius: 6, padding: '1px 7px', fontSize: 10.5, fontWeight: 700 }}>{chip.t}</span>)}
        {!none && !bare && <span style={{ color: OR, fontSize: 12 }}>{o ? '▴' : '▾'}</span>}
      </div>}
      {msg && <div style={{ padding: '0 10px 8px', fontSize: 12, color: '#c0392b' }}>{msg}</div>}
      {!w && <div style={{ padding: '0 10px 10px', fontSize: 12.5, color: '#9a9686' }}>Loading…</div>}
      {w && w.error && <div style={{ padding: '0 10px 10px', fontSize: 12.5, color: '#9a9686' }}>Could not get the forecast now.</div>}
      {days.length > 0 && (
        <div style={{ display: 'flex', borderTop: '1px solid #eef3ef' }}>
          {days.map((d, i) => {
            const on = o && i === sel;
            return (
              <button key={d.date} type="button" onClick={() => { setSel(i); setO(true); }} style={{ flex: 1, minWidth: 0, border: 0, borderBottom: '3px solid ' + LV[d.level].dot, background: on ? '#f1f8f3' : '#fff', padding: '7px 0 6px', font: 'inherit', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b675c', fontWeight: on ? 700 : 400 }}>{dn(d.date, i)}</div>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '3px 0' }}><WxIcon code={d.code} size={20} /></div>
                <div style={{ fontSize: 10.5, color: '#6b675c', lineHeight: '13px' }}>{sky(d.code)}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{d.hi}{'°F'}</div>
                <div style={{ fontSize: 11, color: '#6b675c' }}>{c(d.hi)}{'°C'}</div>
              </button>
            );
          })}
        </div>
      )}
      {o && x && (
        <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #eef3ef' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <WxIcon code={x.code} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{long(x.date, sel)}</div>
              <div style={{ fontSize: 12.5, color: '#6b675c' }}>{sky(x.code)} {'·'} {x.hi}{'°F'} ({c(x.hi)}{'°C'}) / {x.lo}{'°F'} ({c(x.lo)}{'°C'}) {'·'} rain {x.prob}% {'·'} gusts {x.gust} mph</div>
            </div>
            <span style={{ background: LV[x.level].bg, color: LV[x.level].c, borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{LV[x.level].t}</span>
          </div>
          <div style={{ fontSize: 12.5, color: LV[x.level].c, margin: '6px 0 4px' }}>{x.level === 'ok' ? 'Good conditions for outdoor work.' : (x.level === 'no' ? 'Outdoor electrical panels: do not work. ' : 'Be careful: ') + x.why.join(', ') + '.'}</div>
          {PARTS.map(([nm, a, b]) => {
            const rows = hours.filter((h) => { const n = Number(h.t.slice(11, 13)); return n >= a && n <= b; });
            if (!rows.length) return null;
            return (
              <div key={nm} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: '#8a8576', textTransform: 'uppercase', margin: '0 0 2px' }}>{nm}</div>
                {rows.map((h) => { const lv = hourLevel(h, alerts); return (
                  <div key={h.t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px solid #f1f3f1', fontSize: 12.5 }}>
                    <span style={{ width: 44, color: '#6b675c' }}>{hr(Number(h.t.slice(11, 13)))}</span>
                    <span style={{ width: 22, display: 'inline-flex' }}><WxIcon code={h.code} size={16} night={!!h.night} color={lv.c} /></span>
                    <span style={{ width: 38, fontWeight: 600 }}>{h.temp}{'°'}</span>
                    <span style={{ width: 62, color: h.prob >= 50 ? '#c0392b' : '#6b675c' }}>{h.prob}% rain</span>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: lv.c }}>{lv.t}</span>
                    <span style={{ color: '#6b675c' }}>{h.wind} mph</span>
                  </div>
                ); })}
              </div>
            );
          })}
          {hours.length === 0 && <div style={{ fontSize: 12, color: '#9a9686', marginTop: 6 }}>No hourly detail for this day.</div>}
          {(w.alerts || []).length > 0 && <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: '#c0392b', textTransform: 'uppercase', margin: '0 0 3px' }}>Official warnings</div>
            {w.alerts.map((a, i) => <div key={i} style={{ background: '#fdecea', color: '#a02a1f', borderRadius: 8, padding: '6px 9px', margin: '4px 0', fontSize: 12.5 }}><b>{'⚠'} {a.event}</b>{a.ends ? ' until ' + new Date(a.ends).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : ''}<div style={{ fontSize: 11.5, marginTop: 1 }}>{a.headline}</div></div>)}
          </div>}
          {(w.alerts || []).length === 0 && <div style={{ marginTop: 10, fontSize: 12, color: '#2e7d4a' }}>No official warnings for this place.</div>}
          <div style={{ color: '#9a9686', fontSize: 11, marginTop: 8 }}>Source: {w.source || 'forecast'}.</div>
        </div>
      )}
    </div>
  );
}
