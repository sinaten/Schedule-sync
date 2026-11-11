'use client';
import { useEffect, useState } from 'react';

// Admin: one card per user with a "History" folder. Each record = a snapshot of the stage (Yes/No parameter) changes that user made, with date, time and location.
const when = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const yn = (v) => (v === true ? 'Yes' : v === false ? 'No' : '–');

function Records({ name }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    fetch('/api/admin/history?user=' + encodeURIComponent(name), { cache: 'no-store' }).then((r) => r.json()).then((j) => setRows(j.rows || [])).catch(() => setRows([]));
  }, [name]);
  if (!rows) return <p className="muted" style={{ fontSize: 13, margin: '8px 0' }}>Loading…</p>;
  if (!rows.length) return <p className="muted" style={{ fontSize: 13, margin: '8px 0' }}>No records yet.</p>;
  return (
    <div style={{ marginTop: 6 }}>
      {rows.map((r) => {
        const ch = Array.isArray(r.changes) ? r.changes : [];
        const isOpen = open === r.id;
        return (
          <div key={r.id} style={{ borderTop: '1px solid #eef1f3' }}>
            <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen} style={{ font: 'inherit', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0', background: 'none', border: 0, cursor: 'pointer', fontSize: 13, color: '#16262e', textAlign: 'left' }}>
              <span>{when(r.taken_at)}</span>
              <span style={{ color: '#8a979d', fontSize: 12 }}>{ch.length + ' change' + (ch.length === 1 ? '' : 's')} {isOpen ? '▴' : '▾'}</span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 0 10px' }}>
                {r.lat != null && r.lng != null && (
                  <a href={'https://www.google.com/maps?q=' + r.lat + ',' + r.lng} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2a6f97' }}>Location: {Number(r.lat).toFixed(5)}, {Number(r.lng).toFixed(5)}</a>
                )}
                {ch.length === 0 && <div style={{ fontSize: 12, color: '#8a979d', marginTop: 4 }}>No changes in this record.</div>}
                {ch.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#45565e', padding: '4px 0', borderBottom: '1px dashed #f0f3f5' }}>
                    <b>{c.name || c.element}</b> · {c.param}: {yn(c.from)} → <b>{yn(c.to)}</b>{c.at ? <span style={{ color: '#8a979d' }}> · {when(c.at)}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function UserManage() {
  const [users, setUsers] = useState(null);
  const [who, setWho] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    fetch('/api/admin/history', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.users) setUsers(j.users); else setMsg(j.error || 'Could not load'); }).catch(() => setMsg('Could not load'));
  }, []);
  if (!users) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  if (!users.length) return <p className="muted" style={{ fontSize: 13 }}>No users yet.</p>;
  return (
    <div style={{ maxWidth: 560 }}>
      {users.map((u) => {
        const on = who === u.username;
        return (
          <div key={u.username} style={{ border: '1px solid #e6eaed', borderRadius: 14, padding: '4px 16px', marginBottom: 10, background: '#fff' }}>
            <button type="button" onClick={() => setWho(on ? null : u.username)} aria-expanded={on} style={{ font: 'inherit', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', background: 'none', border: 0, cursor: 'pointer', fontSize: 15, color: '#16262e' }}>
              <span><b>{u.username}</b> <span style={{ fontSize: 12, color: '#8a979d' }}>{u.role}</span></span>
              <span style={{ fontSize: 12, color: '#8a979d' }}>{'History · ' + u.n + ' '}{on ? '▴' : '▾'}</span>
            </button>
            {on && (
              <div style={{ paddingBottom: 10 }}>
                {u.last && <div style={{ fontSize: 12, color: '#8a979d' }}>Last record: {when(u.last)}</div>}
                <Records name={u.username} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
