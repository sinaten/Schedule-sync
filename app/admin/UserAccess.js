'use client';
import { useEffect, useRef, useState } from 'react';

// Admin only: per-person permissions. One small button opens a card with a searchable "User" field (type to filter, or tap to see the list, up to 10 shown).
// Pick a user and their permission boxes appear underneath. Ticked = allowed. Save folds it back.
export default function UserAccess() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const [list, setList] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef(null);
  useEffect(() => {
    fetch('/api/admin/user-perms', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.perms) setD(j); else setMsg(j.error || 'Could not load'); }).catch(() => setMsg('Could not load'));
  }, []);
  useEffect(() => {
    const f = (e) => { if (box.current && !box.current.contains(e.target)) setList(false); };
    document.addEventListener('mousedown', f);
    document.addEventListener('touchstart', f);
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('touchstart', f); };
  }, []);
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/admin/user-perms', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d.values) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg(''); setOpen(false); setWho(''); setQ(''); } else setMsg(j.error || 'Failed');
  }
  if (!d) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  const pill = { font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#45565e', cursor: 'pointer' };
  const set = (name, k, val) => setD({ ...d, values: { ...d.values, [name]: { ...(d.values[name] || {}), [k]: val } } });
  const term = q.trim().toLowerCase();
  const shown = d.users.filter((u) => !term || u.username.toLowerCase().includes(term)).slice(0, 10);
  const pick = (u) => { setWho(u.username); setQ(u.username); setList(false); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setList(true); setHi(Math.min(hi + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(hi - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list && shown[hi]) pick(shown[hi]); }
    else if (e.key === 'Escape') setList(false);
  };
  const cur = d.users.find((u) => u.username === who);
  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button" style={pill} onClick={() => setOpen(!open)} aria-expanded={open}>{'User access ' + (open ? '▴' : '▾')}</button>
      {open && (
        <div style={{ marginTop: 8, border: '1px solid #e6eaed', borderRadius: 16, padding: '16px 18px', maxWidth: 440, background: '#fff', boxShadow: '0 6px 24px rgba(22,38,46,.08)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8a979d', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 6 }}>User</div>
          <div ref={box} style={{ position: 'relative' }}>
            <input
              value={q}
              placeholder="Search or pick a user…"
              onChange={(e) => { setQ(e.target.value); setWho(''); setList(true); setHi(0); }}
              onFocus={() => setList(true)}
              onClick={() => setList(true)}
              onKeyDown={onKey}
              autoComplete="off"
              style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 16, padding: '13px 40px 13px 14px', borderRadius: 12, border: '1.5px solid ' + (list ? '#16262e' : '#d5dce0'), outline: 'none', background: '#fafbfc', color: '#16262e', transition: 'border-color .15s' }}
            />
            <span onClick={() => setList(!list)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: '#8a979d', cursor: 'pointer', fontSize: 13 }}>{list ? '▴' : '▾'}</span>
            {list && (
              <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1px solid #e6eaed', borderRadius: 12, boxShadow: '0 10px 28px rgba(22,38,46,.14)', maxHeight: 340, overflowY: 'auto', padding: 4 }}>
                {shown.length === 0 && <div style={{ padding: '10px 12px', fontSize: 13, color: '#8a979d' }}>No match</div>}
                {shown.map((u, i) => (
                  <div key={u.username} onMouseDown={(e) => { e.preventDefault(); pick(u); }} onMouseEnter={() => setHi(i)} style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: i === hi ? '#f0f4f6' : 'transparent', fontSize: 15, color: '#16262e' }}>
                    <span>{u.username}</span>
                    <span style={{ fontSize: 12, color: '#8a979d' }}>{u.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {cur && (
            <div style={{ marginTop: 16 }}>
              {d.perms.map((p) => {
                const on = !!(d.values[cur.username] && d.values[cur.username][p.key]);
                return (
                  <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', marginBottom: 6, borderRadius: 12, border: '1px solid ' + (on ? '#16262e' : '#e6eaed'), background: on ? '#f4f7f8' : '#fff', cursor: 'pointer', fontSize: 14, color: '#16262e', transition: 'all .15s' }}>
                    <input type="checkbox" checked={on} onChange={(e) => set(cur.username, p.key, e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#16262e' }} />
                    {p.label}
                  </label>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <button type="button" onClick={save} style={{ ...pill, background: '#16262e', color: '#fff', border: 0, padding: '8px 18px' }}>Save</button>
            <span style={{ fontSize: 12, color: '#8a979d' }}>{cur ? 'Not ticked = not allowed.' : 'Pick a user to set access.'}</span>
            {msg && <b style={{ fontSize: 12, color: '#b00020' }}>{msg}</b>}
          </div>
        </div>
      )}
    </div>
  );
}
