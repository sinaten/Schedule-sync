'use client';
import { useEffect, useState } from 'react';

// Admin only: per-person permissions. Collapsed to one small button; each username opens its own list of boxes. Ticked = allowed. Save folds it back.
export default function UserAccess() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState(null);
  useEffect(() => {
    fetch('/api/admin/user-perms', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.perms) setD(j); else setMsg(j.error || 'Could not load'); }).catch(() => setMsg('Could not load'));
  }, []);
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/admin/user-perms', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d.values) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg(''); setOpen(false); setWho(null); } else setMsg(j.error || 'Failed');
  }
  if (!d) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  const pill = { font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#45565e', cursor: 'pointer' };
  const set = (name, k, val) => setD({ ...d, values: { ...d.values, [name]: { ...(d.values[name] || {}), [k]: val } } });
  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" style={pill} onClick={() => setOpen(!open)} aria-expanded={open}>{'User access ' + (open ? '▴' : '▾')}</button>
      {open && (
        <div style={{ marginTop: 8, border: '1px solid #e6eaed', borderRadius: 12, padding: '6px 14px 10px', maxWidth: 440, background: '#fafbfc' }}>
          {d.users.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No users yet.</p>}
          {d.users.map((u) => (
            <div key={u.username} style={{ borderBottom: '1px solid #eef1f3' }}>
              <button type="button" onClick={() => setWho(who === u.username ? null : u.username)} aria-expanded={who === u.username} style={{ font: 'inherit', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', background: 'none', border: 0, cursor: 'pointer', fontSize: 14, color: '#16262e' }}>
                <span>{u.username} <span style={{ fontSize: 12, color: '#8a979d' }}>{u.role}</span></span>
                <span style={{ color: '#8a979d' }}>{who === u.username ? '▴' : '▾'}</span>
              </button>
              {who === u.username && (
                <div style={{ padding: '0 0 10px 2px' }}>
                  {d.perms.map((p) => (
                    <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 13, color: '#45565e', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!(d.values[u.username] && d.values[u.username][p.key])} onChange={(e) => set(u.username, p.key, e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                      {p.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button type="button" onClick={save} style={{ ...pill, background: '#16262e', color: '#fff', border: 0 }}>Save</button>
            <span style={{ fontSize: 12, color: '#8a979d' }}>Not ticked = not allowed.</span>
            {msg && <b style={{ fontSize: 12, color: '#b00020' }}>{msg}</b>}
          </div>
        </div>
      )}
    </div>
  );
}
