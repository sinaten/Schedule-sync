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
    setMsg(r.ok ? 'Saved' : j.error || 'Failed');
  }
  if (!v) return <p className="muted">{msg || 'Loading…'}</p>;
  const set = (k, p) => setV({ ...v, [k]: { ...v[k], ...p } });
  return (
    <div style={{ border: '1px solid #e1e5e8', borderRadius: 12, padding: '14px 16px', marginBottom: 20, maxWidth: 560 }}>
      <b>Time limits (counted from the upload)</b>
      <p className="muted" style={{ margin: '4px 0 12px', fontSize: 13 }}>Admins are never limited. After the time is over the photo disappears from that person's pages.</p>
      {ROWS.map(([k, label]) => (
        <div key={k} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 14, marginBottom: 4 }}>{label}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={v[k].unit} onChange={(e) => set(k, { unit: e.target.value })} style={{ padding: 8, fontSize: 15 }}>
              <option value="unlimited">No limit</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
            {v[k].unit !== 'unlimited' && <input type="number" min="0" value={v[k].n} onChange={(e) => set(k, { n: e.target.value })} style={{ padding: 8, fontSize: 15, width: 90 }} />}
          </div>
        </div>
      ))}
      <button type="button" onClick={save} style={{ padding: '9px 18px', fontSize: 15 }}>Save</button>
      {msg && <b style={{ marginLeft: 12 }}>{msg}</b>}
    </div>
  );
}
