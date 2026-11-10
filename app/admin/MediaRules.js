'use client';
import { useEffect, useState } from 'react';

// Admin only: time limits for viewing / deleting photos and videos, counted from the moment of upload.
const ROWS = [
  ['userView', 'Regular user can view their own photos for'],
  ['userDelete', 'Regular user can delete their own photos for'],
  ['editorView', 'Editor can view photos for'],
  ['editorDelete', 'Editor can delete photos for'],
];
const UNIT = { minutes: 1, hours: 60, days: 1440 };

function split(min) {
  if (min === null || min === undefined) return { unit: 'unlimited', n: 1 };
  if (min > 0 && min % 1440 === 0) return { unit: 'days', n: min / 1440 };
  if (min > 0 && min % 60 === 0) return { unit: 'hours', n: min / 60 };
  return { unit: 'minutes', n: min };
}

export default function MediaRules() {
  const [v, setV] = useState(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch('/api/admin/media-rules', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      const o = {};
      for (const [k] of ROWS) o[k] = split(j[k]);
      setV(o);
    }).catch(() => setMsg('Could not load'));
  }, []);
  async function save() {
    setMsg('Saving…');
    const body = {};
    for (const [k] of ROWS) body[k] = v[k].unit === 'unlimited' ? null : Math.max(0, Number(v[k].n) || 0) * UNIT[v[k].unit];
    const r = await fetch('/api/admin/media-rules', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg(''); setOpen(false); } else setMsg(j.error || 'Failed');
  }
  if (!v) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  const set = (k, p) => setV({ ...v, [k]: { ...v[k], ...p } });
  const pill = { font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#45565e', cursor: 'pointer' };
  const field = { padding: '5px 8px', fontSize: 13, borderRadius: 8, border: '1px solid #d5dce0', background: '#fff' };
  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" style={pill} onClick={() => setOpen(!open)} aria-expanded={open}>{'Time limits ' + (open ? '▴' : '▾')}</button>
      {open && (
        <div style={{ marginTop: 8, border: '1px solid #e6eaed', borderRadius: 12, padding: '10px 14px', maxWidth: 440, background: '#fafbfc' }}>
          {ROWS.map(([k, label]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: '#45565e' }}>{label.replace(/ for$/, '')}</span>
              <span style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
                {v[k].unit !== 'unlimited' && <input type="number" min="0" value={v[k].n} onChange={(e) => set(k, { n: e.target.value })} style={{ ...field, width: 56 }} />}
                <select value={v[k].unit} onChange={(e) => set(k, { unit: e.target.value })} style={field}>
                  <option value="unlimited">No limit</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={save} style={{ ...pill, background: '#16262e', color: '#fff', border: 0 }}>Save</button>
            <span style={{ fontSize: 12, color: '#8a979d' }}>Admins are never limited.</span>
            {msg && <b style={{ fontSize: 12, color: '#b00020' }}>{msg}</b>}
          </div>
        </div>
      )}
    </div>
  );
}
