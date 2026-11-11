'use client';
import { useEffect, useState } from 'react';

// Admin only: how often a History record is taken (hours). Collapsed to one small button; Save folds it back.
export default function HistoryRules() {
  const [h, setH] = useState(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch('/api/admin/history-rules', { cache: 'no-store' }).then((r) => r.json()).then((j) => setH(j.hours)).catch(() => setMsg('Could not load'));
  }, []);
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/admin/history-rules', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hours: Number(h) }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg(''); setOpen(false); } else setMsg(j.error || 'Failed');
  }
  if (h == null) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  const pill = { font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#45565e', cursor: 'pointer' };
  const field = { padding: '5px 8px', fontSize: 13, borderRadius: 8, border: '1px solid #d5dce0', background: '#fff', width: 64, boxSizing: 'border-box' };
  const quick = [1, 4, 12, 24];
  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" style={pill} onClick={() => setOpen(!open)} aria-expanded={open}>{'History ' + (open ? '▴' : '▾')}</button>
      {open && (
        <div style={{ marginTop: 8, border: '1px solid #e6eaed', borderRadius: 12, padding: '10px 14px', maxWidth: 440, background: '#fafbfc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#45565e', flexWrap: 'wrap' }}>
            <span>Save a record every</span>
            <input type="number" min="1" max="168" value={h} onChange={(e) => setH(e.target.value)} style={field} />
            <span>hours</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {quick.map((q) => (
              <button key={q} type="button" onClick={() => setH(q)} style={{ ...pill, padding: '3px 10px', fontSize: 12, background: Number(h) === q ? '#16262e' : '#fff', color: Number(h) === q ? '#fff' : '#45565e' }}>{q === 24 ? 'daily' : q + ' h'}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button type="button" onClick={save} style={{ ...pill, background: '#16262e', color: '#fff', border: 0 }}>Save</button>
            <span style={{ fontSize: 12, color: '#8a979d' }}>Each record holds the stage changes since the last one.</span>
            {msg && <b style={{ fontSize: 12, color: '#b00020' }}>{msg}</b>}
          </div>
        </div>
      )}
    </div>
  );
}
