'use client';
import { useEffect, useState } from 'react';

// Admin settings: QR parameters from Revit. Collapsed to one small button; Save folds it back.
export default function Settings() {
  const [c, setC] = useState(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch('/api/admin/qr-config', { cache: 'no-store' }).then((r) => r.json()).then(setC).catch(() => setMsg('Could not load settings'));
  }, []);
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/admin/qr-config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg(''); setOpen(false); } else setMsg(j.error || 'Failed (' + r.status + ')');
  }
  if (!c) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  const pill = { font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#45565e', cursor: 'pointer' };
  const field = { padding: '5px 8px', fontSize: 13, borderRadius: 8, border: '1px solid #d5dce0', background: '#fff', boxSizing: 'border-box' };
  const row = { padding: '6px 0' };
  const lab = { fontSize: 13, color: '#45565e', display: 'block', marginBottom: 3 };
  const hint = { display: 'block', fontSize: 12, color: '#8a979d', marginTop: 3 };
  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" style={pill} onClick={() => setOpen(!open)} aria-expanded={open}>{'QR parameters ' + (open ? '▴' : '▾')}</button>
      {open && (
        <div style={{ marginTop: 8, border: '1px solid #e6eaed', borderRadius: 12, padding: '10px 14px', maxWidth: 440, background: '#fafbfc' }}>
          <label style={row}>
            <span style={lab}>Input parameter (the name)</span>
            <input style={{ ...field, width: '100%' }} value={c.nameParam} onChange={(e) => setC({ ...c, nameParam: e.target.value })} />
            <span style={hint}>Text parameter in Revit. Whatever you type there becomes the QR name.</span>
          </label>
          <label style={row}>
            <span style={lab}>Output parameter (the link)</span>
            <input style={{ ...field, width: '100%' }} value={c.codeParam} onChange={(e) => setC({ ...c, codeParam: e.target.value })} />
            <span style={hint}>URL parameter in Revit. The sync writes the PDF download link here, only where it is empty.</span>
          </label>
          <label style={row}>
            <span style={lab}>QR print size (cm)</span>
            <input style={{ ...field, width: 80 }} type="number" min="2" max="18" step="0.5" value={c.sizeCm} onChange={(e) => setC({ ...c, sizeCm: e.target.value })} />
            <span style={hint}>Size of the QR square in the PDF. Print at “Actual size” (100%).</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={save} style={{ ...pill, background: '#16262e', color: '#fff', border: 0 }}>Save</button>
            {msg && <b style={{ fontSize: 12, color: '#b00020' }}>{msg}</b>}
          </div>
        </div>
      )}
    </div>
  );
}
