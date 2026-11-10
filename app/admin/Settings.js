'use client';
import { useEffect, useState } from 'react';

export default function Settings() {
  const [c, setC] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    fetch('/api/admin/qr-config', { cache: 'no-store' }).then((r) => r.json()).then(setC).catch(() => setMsg('Could not load settings'));
  }, []);
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/admin/qr-config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Saved' : j.error || 'Failed (' + r.status + ')');
  }
  if (!c) return <p className="muted">{msg || 'Loading…'}</p>;
  const inp = { padding: '8px', fontSize: 15, boxSizing: 'border-box', width: '100%', maxWidth: 360 };
  const lab = { display: 'block', marginBottom: 14 };
  const hint = { display: 'block', fontSize: 13, color: '#5d6f77', marginTop: 3 };
  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>QR codes from Revit</h2>
      <label style={lab}>Input parameter (the name)
        <input style={inp} value={c.nameParam} onChange={(e) => setC({ ...c, nameParam: e.target.value })} />
        <span style={hint}>Text parameter in Revit. Whatever you type there becomes the QR name.</span>
      </label>
      <label style={lab}>Output parameter (the link)
        <input style={inp} value={c.codeParam} onChange={(e) => setC({ ...c, codeParam: e.target.value })} />
        <span style={hint}>URL parameter in Revit. The sync writes the PDF download link here, only where it is empty.</span>
      </label>
      <label style={lab}>QR print size (cm)
        <input style={{ ...inp, maxWidth: 120 }} type="number" min="2" max="18" step="0.5" value={c.sizeCm} onChange={(e) => setC({ ...c, sizeCm: e.target.value })} />
        <span style={hint}>Size of the QR square in the PDF. Print at “Actual size” (100%).</span>
      </label>
      <button style={{ padding: '10px 18px', fontSize: 16 }} onClick={save}>Save</button>
      {msg && <b style={{ marginLeft: 12 }}>{msg}</b>}
    </div>
  );
}
