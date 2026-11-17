'use client';
import { useEffect, useState } from 'react';
import WeatherTab from './WeatherTab';

const STEPS = ['Find the person', 'Ask for a time', 'Appointment confirmed', 'Class held', 'Permission received'];
const HINT = ['Who runs the orientation (from Location and Information).', 'Call or email them. Write who and when.', 'Date, time, place, what to bring.', 'Mark it when the person attended.', 'Badge or approval email. The HSE manager confirms.'];
const OR = '#e8710a';
const FIELDS = [['hospital', 'Nearest hospital'], ['hospital_phone', 'Hospital phone'], ['hospital_address', 'Hospital address'], ['hse_name', 'HSE manager'], ['hse_phone', 'HSE phone'], ['hse_email', 'HSE email'], ['gc_name', 'GC representative (keys)'], ['gc_phone', 'GC phone'], ['orient_name', 'Orientation contact'], ['orient_phone', 'Orientation phone'], ['orient_email', 'Orientation email'], ['orient_place', 'Where the class is'], ['muster', 'Muster point'], ['first_aid', 'First aid / AED / eyewash']];
const need = ['hospital', 'hse_name', 'muster'];
const chip = (bg, c, t) => <span style={{ background: bg, color: c, borderRadius: 6, padding: '1px 7px', fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{t}</span>;
const sub = (extra) => ({ position: 'relative', margin: '8px 0 0 22px', border: '1px solid #d9d5c8', borderRadius: 10, background: '#fff', ...extra });
const dot = { position: 'absolute', left: -14, top: 20, width: 12, borderTop: '1.5px dotted #b8b4a4' };
const hdr = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px', cursor: 'pointer', fontSize: 14, fontWeight: 600 };

// The HSE bar: three sub-bars (Location and information, Orientation, JHA form and PPE). Orientation has five steps per person; JHA and PPE wait until someone is allowed.
export default function HseBar({ job }) {
  const [d, setD] = useState(null);
  const [o, setO] = useState({});
  const [np, setNp] = useState('');
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({});
  const load = () => fetch('/api/hse?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (!j.error) setD(j); }).catch(() => {});
  useEffect(() => { load(); }, [job]);
  const post = async (b) => { const r = await fetch('/api/hse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, ...b }) }); const j = await r.json().catch(() => ({})); if (!r.ok) alert(j.error || 'Could not save'); await load(); };
  if (!d) return <div style={{ padding: '10px 2px', fontSize: 13, color: '#9a9686' }}>Loading…</div>;
  const p = d.profile || {}, can = d.can;
  const complete = need.every((k) => p[k]);
  const allowed = (x) => !!(x.steps && x.steps['5']);
  const anyAllowed = d.people.some(allowed);
  const tog = (k) => setO((s) => ({ ...s, [k]: !s[k] }));
  const arrow = (k) => <span style={{ color: OR, fontSize: 12 }}>{o[k] ? '▴' : '▾'}</span>;
  const inp = { display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0dccf', borderRadius: 9, height: 32, padding: '0 9px', margin: '2px 0 7px', font: 'inherit', fontSize: 13.5, outline: 'none', background: '#fff' };
  return (
    <div style={{ paddingBottom: 6 }}>
      <div style={sub()}>
        <span style={dot} />
        <div role="button" tabIndex={0} onClick={() => tog('loc')} style={hdr}><span style={{ flex: 1 }}>Location and Information</span>{complete ? chip('#e1f3e6', '#2c7a47', 'complete') : chip('#fdecea', '#c0392b', '⚠ incomplete')}{arrow('loc')}</div>
        {o.loc && (
          <div style={{ padding: '0 10px 10px', fontSize: 13 }}>
            {!edit && FIELDS.map(([k, l]) => <div key={k} style={{ display: 'flex', gap: 8, padding: '3px 0', borderTop: '1px solid #f1ede4' }}><span style={{ width: 120, flex: 'none', color: '#8a8576', fontSize: 11.5 }}>{l}</span><span style={{ flex: 1, wordBreak: 'break-word', color: p[k] ? '#141413' : '#c0392b' }}>{p[k] || (need.includes(k) ? 'missing' : '')}{k.endsWith('phone') && p[k] ? <a href={'tel:' + p[k]} style={{ marginLeft: 8, color: OR }}>Call</a> : null}</span></div>)}
            {edit && FIELDS.map(([k, l]) => <label key={k} style={{ display: 'block', fontSize: 11.5, color: '#8a8576' }}>{l}<input style={inp} value={f[k] ?? p[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>)}
            {can && <div style={{ marginTop: 8 }}>{!edit ? <button type="button" onClick={() => { setF({}); setEdit(true); }} style={{ border: '1px solid #d9d5c8', background: '#fff', borderRadius: 12, padding: '4px 14px', font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>Edit</button> : <button type="button" onClick={async () => { await post({ action: 'profile', data: f }); setEdit(false); }} style={{ border: 0, background: '#2e9e5b', color: '#fff', borderRadius: 14, padding: '6px 22px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>}</div>}
          </div>
        )}
      </div>

      <div style={sub({ borderColor: anyAllowed ? '#bfe0c8' : '#f0d9a8' })}>
        <span style={dot} />
        <div role="button" tabIndex={0} onClick={() => tog('ori')} style={hdr}><span style={{ flex: 1 }}>Orientation</span>{chip(anyAllowed ? '#e1f3e6' : '#fff3dc', anyAllowed ? '#2c7a47' : '#a86400', d.people.filter(allowed).length + ' of ' + d.people.length + ' allowed')}{arrow('ori')}</div>
        {o.ori && (
          <div style={{ padding: '0 0 8px' }}>
            {d.people.length === 0 && <div style={{ padding: '2px 12px 6px', fontSize: 13, color: '#9a9686' }}>No people yet.</div>}
            {d.people.map((x) => {
              const st = x.steps || {}, n = STEPS.filter((_, i) => st[String(i + 1)]).length, k = 'p:' + x.name;
              return (
                <div key={x.name} style={{ position: 'relative', margin: '0 10px 7px 22px', border: '1px solid ' + (allowed(x) ? '#bfe0c8' : '#e7e3d8'), borderRadius: 8, background: '#faf9f5' }}>
                  <span style={dot} />
                  <div role="button" tabIndex={0} onClick={() => tog(k)} style={{ ...hdr, fontSize: 13, padding: '8px 9px' }}><span style={{ flex: 1 }}>{x.name}<br /><span style={{ fontWeight: 400, fontSize: 11.5, color: '#8a8576' }}>{allowed(x) ? (x.expiry ? 'Cleared until ' + x.expiry : 'Cleared') : 'Step ' + Math.min(n + 1, 5) + ' of 5' + (n >= 2 && x.appt ? ' \u00B7 ' + x.appt : '')}</span></span>{allowed(x) ? chip('#e1f3e6', '#2c7a47', 'allowed') : n >= 2 ? chip('#fff3dc', '#a86400', 'appointment set') : chip('#f4f3ee', '#6b675c', 'not started')}{arrow(k)}</div>
                  {o[k] && (
                    <div style={{ padding: '0 9px 9px', position: 'relative' }}>
                      {STEPS.map((t, i) => {
                        const s = st[String(i + 1)], prev = i === 0 || st[String(i)];
                        return (
                          <div key={t} style={{ position: 'relative', margin: '6px 0 0 18px', border: '1px solid #e7e3d8', borderRadius: 8, background: '#fff', padding: '7px 9px', fontSize: 12.5 }}>
                            <span style={{ ...dot, left: -12, width: 10, top: 18 }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 20, height: 20, borderRadius: 10, background: s ? '#2e9e5b' : '#f4f3ee', color: s ? '#fff' : '#8a8576', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flex: 'none' }}>{s ? '✓' : i + 1}</span>
                              <span style={{ flex: 1 }}>{t}</span>
                              {can && (s ? <button type="button" onClick={() => post({ action: 'step', name: x.name, step: i + 1, done: false })} style={{ border: 0, background: 'none', color: '#9a9686', cursor: 'pointer', fontSize: 12 }}>Undo</button> : <button type="button" disabled={!prev} onClick={() => post({ action: 'step', name: x.name, step: i + 1, done: true })} style={{ border: 0, borderRadius: 12, padding: '3px 12px', background: prev ? OR : '#e7e3d8', color: '#fff', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: prev ? 'pointer' : 'default' }}>Done</button>)}
                            </div>
                            {!s && <div style={{ color: '#9a9686', fontSize: 11, marginTop: 2 }}>{HINT[i]}</div>}
                            {s && <div style={{ color: '#8a8576', fontSize: 11, marginTop: 2 }}>{s.by} {'·'} {new Date(s.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>}
                            {i === 0 && p.orient_name && <div style={{ color: '#6b675c', fontSize: 11.5, marginTop: 2 }}>{p.orient_name} {p.orient_phone || ''} {p.orient_email || ''}</div>}
                            {i === 2 && (can ? <input placeholder="Date, time, place, what to bring" defaultValue={x.appt || ''} onBlur={(e) => { if (e.target.value !== (x.appt || '')) post({ action: 'step', name: x.name, step: 3, appt: e.target.value }); }} style={{ ...inp, margin: '5px 0 0', height: 30, fontSize: 12.5 }} /> : x.appt && <div style={{ color: '#6b675c', marginTop: 2 }}>{x.appt}</div>)}
                            {i === 4 && (can ? <input placeholder="Permission expires (date)" defaultValue={x.expiry || ''} onBlur={(e) => { if (e.target.value !== (x.expiry || '')) post({ action: 'step', name: x.name, step: 5, expiry: e.target.value }); }} style={{ ...inp, margin: '5px 0 0', height: 30, fontSize: 12.5 }} /> : x.expiry && <div style={{ color: '#6b675c', marginTop: 2 }}>Expires {x.expiry}</div>)}
                          </div>
                        );
                      })}
                      {!allowed(x) && <div style={{ marginTop: 8, background: '#f4f3ee', borderRadius: 8, padding: '6px 9px', fontSize: 12, color: '#6b675c' }}>{'\u{1F512}'} {x.name} cannot start work until step 5 is confirmed.</div>}
                      {can && <button type="button" onClick={() => { if (confirm('Remove ' + x.name + '?')) post({ action: 'person-del', name: x.name }); }} style={{ marginTop: 8, border: 0, background: 'none', color: '#9a9686', cursor: 'pointer', fontSize: 12 }}>Remove person</button>}
                    </div>
                  )}
                </div>
              );
            })}
            {can && (
              <div style={{ display: 'flex', gap: 8, margin: '4px 10px 0 22px' }}>
                <input value={np} onChange={(e) => setNp(e.target.value)} placeholder="Add a person" style={{ ...inp, margin: 0, flex: 1, minWidth: 0 }} />
                <button type="button" disabled={!np.trim()} onClick={async () => { await post({ action: 'person-add', name: np }); setNp(''); }} style={{ border: 0, borderRadius: 16, padding: '0 16px', background: np.trim() ? OR : '#e7e3d8', color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: np.trim() ? 'pointer' : 'default' }}>Add</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={sub()}>
        <span style={dot} />
        <div style={{ padding: '2px 10px' }}><WeatherTab job={job} /></div>
      </div>

      <div style={sub({ opacity: anyAllowed ? 1 : 0.55, background: anyAllowed ? '#fff' : '#f4f3ee' })}>
        <span style={dot} />
        <div style={{ ...hdr, cursor: 'default' }}><span>{anyAllowed ? '' : '\u{1F512}'}</span><span style={{ flex: 1 }}>JHA form and PPE</span>{anyAllowed ? chip('#f4f3ee', '#6b675c', 'coming next') : chip('#f4f3ee', '#6b675c', 'after Orientation')}</div>
      </div>
    </div>
  );
}
