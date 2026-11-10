'use client';
import { useEffect, useState } from 'react';

// Admin only: distance rings for the photo frames. Collapsed to one small button; Save folds it back.
export default function LocationRules() {
  const [v, setV] = useState(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch('/api/admin/location-rules', { cache: 'no-store' }).then((r) => r.json()).then((j) => setV({ green: j.green, orange: j.orange })).catch(() => setMsg('Could not load'));
  }, []);
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/admin/location-rules', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ green: Number(v.green), orange: Number(v.orange) }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg(''); setOpen(false); } else setMsg(j.error || 'Failed');
  }
  if (!v) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  const pill = { font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#45565e', cursor: 'pointer' };
  const field = { padding: '5px 8px', fontSize: 13, borderRadius: 8, border: '1px solid #d5dce0', background: '#fff', width: 64, boxSizing: 'border-box' };
  const dot = (c) => <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 5, background: c, marginRight: 8 }} />;
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 13, color: '#45565e' };
  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" style={pill} onClick={() => setOpen(!open)} aria-expanded={open}>{'Location ' + (open ? '▴' : '▾')}</button>
      {open && (
        <div style={{ marginTop: 8, border: '1px solid #e6eaed', borderRadius: 12, padding: '10px 14px', maxWidth: 440, background: '#fafbfc' }}>
          <div style={row}>
            <span>{dot('#2e9d57')}Green up to</span>
            <span><input type="number" min="1" value={v.green} onChange={(e) => setV({ ...v, green: e.target.value })} style={field} /> m</span>
          </div>
          <div style={row}>
            <span>{dot('#f08c1a')}Orange up to</span>
            <span><input type="number" min="2" value={v.orange} onChange={(e) => setV({ ...v, orange: e.target.value })} style={field} /> m</span>
          </div>
          <div style={row}>
            <span>{dot('#d93025')}Red beyond {v.orange} m</span>
            <span />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={save} style={{ ...pill, background: '#16262e', color: '#fff', border: 0 }}>Save</button>
            <span style={{ fontSize: 12, color: '#8a979d' }}>Distance of the photo from the QR location.</span>
            {msg && <b style={{ fontSize: 12, color: '#b00020' }}>{msg}</b>}
          </div>
        </div>
      )}
    </div>
  );
}
