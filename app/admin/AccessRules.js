'use client';
import { useEffect, useState } from 'react';

// Admin only: who may see which part of the site. Admins always see everything. Collapsed to one small button; Save folds it back.
export default function AccessRules() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch('/api/admin/access', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.features) setD(j); else setMsg(j.error || 'Could not load'); }).catch(() => setMsg('Could not load'));
  }, []);
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/admin/access', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d.access) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg(''); setOpen(false); } else setMsg(j.error || 'Failed');
  }
  if (!d) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  const pill = { font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#45565e', cursor: 'pointer' };
  const set = (k, role, val) => setD({ ...d, access: { ...d.access, [k]: { ...d.access[k], [role]: val } } });
  const head = { fontSize: 12, color: '#8a979d', fontWeight: 600, textAlign: 'center', padding: '0 8px' };
  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" style={pill} onClick={() => setOpen(!open)} aria-expanded={open}>{'Access ' + (open ? '▴' : '▾')}</button>
      {open && (
        <div style={{ marginTop: 8, border: '1px solid #e6eaed', borderRadius: 12, padding: '10px 14px', maxWidth: 440, background: '#fafbfc' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr><th style={{ ...head, textAlign: 'left', paddingLeft: 0 }}>Who can see</th><th style={head}>Editors</th><th style={head}>Users</th></tr>
            </thead>
            <tbody>
              {d.features.map((f) => (
                <tr key={f.key}>
                  <td style={{ padding: '7px 0', fontSize: 13, color: '#45565e' }}>{f.label}</td>
                  {['editor', 'viewer'].map((role) => (
                    <td key={role} style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={!!d.access[f.key][role]} onChange={(e) => set(f.key, role, e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={save} style={{ ...pill, background: '#16262e', color: '#fff', border: 0 }}>Save</button>
            <span style={{ fontSize: 12, color: '#8a979d' }}>Admins always see everything.</span>
            {msg && <b style={{ fontSize: 12, color: '#b00020' }}>{msg}</b>}
          </div>
        </div>
      )}
    </div>
  );
}
