'use client';
import { useEffect, useState, useCallback } from 'react';

const ROLE_HELP = { admin: 'Sees everything and manages users', editor: 'Sees chosen jobs and can edit tables', viewer: 'Sees chosen jobs, read only' };

function JobPicker({ all, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const set = new Set(value);
  const toggle = (j) => { const n = new Set(set); n.has(j) ? n.delete(j) : n.add(j); onChange([...n]); };
  if (!all.length) return <span className="muted">No jobs yet</span>;
  const shown = all.filter((j) => j.toLowerCase().includes(q.trim().toLowerCase()));
  const n = value.length;
  const summary = n === 0 ? 'None selected' : n <= 2 ? value.join(', ') : n + ' of ' + all.length + ' selected';
  return (
    <div style={{ minWidth: 200, maxWidth: 320 }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 15, background: '#fff', border: '1px solid #cfd8dc', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        <span aria-hidden="true" style={{ flex: 'none', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && (
        <div style={{ marginTop: 4, border: '1px solid #cfd8dc', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
          <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', padding: '9px 10px', fontSize: 15, border: 0, borderBottom: '1px solid #e3e8ea', boxSizing: 'border-box', outline: 'none' }} />
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {shown.map((j) => (
              <label key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f0f3f4', cursor: 'pointer' }}>
                <input type="checkbox" checked={set.has(j)} onChange={() => toggle(j)} style={{ width: 18, height: 18 }} />
                <span>{j}</span>
              </label>
            ))}
            {shown.length === 0 && <div className="muted" style={{ padding: 12 }}>No match</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Users() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [nu, setNu] = useState({ username: '', password: '', role: 'viewer', jobs: [] });
  const [pw, setPw] = useState({});
  const load = useCallback(async () => {
    const r = await fetch('/api/admin/users', { cache: 'no-store' });
    if (r.ok) setD(await r.json()); else setMsg('Could not load users (' + r.status + ')');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(u) {
    setMsg('Saving…');
    const r = await fetch('/api/admin/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(u) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Saved' : j.error || 'Failed (' + r.status + ')');
    if (r.ok) await load();
    return r.ok;
  }
  async function del(name) {
    if (!confirm('Delete user ' + name + '?')) return;
    const r = await fetch('/api/admin/users?username=' + encodeURIComponent(name), { method: 'DELETE' });
    setMsg(r.ok ? 'Deleted ' + name : 'Failed (' + r.status + ')');
    await load();
  }
  async function share(name) {
    const url = location.origin + '/login';
    const text = name ? 'You are invited to Schedule Sync.\nOpen: ' + url + '\nUsername: ' + name + '\n(I will send your password separately.)' : 'Schedule Sync: ' + url;
    try {
      if (navigator.share) { await navigator.share({ title: 'Schedule Sync invite', text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); setMsg('Invite copied - paste it in a message'); } catch (e) { prompt('Copy this invite:', text); }
  }
  if (!d) return <p className="muted">{msg || 'Loading…'}</p>;
  const cell = { padding: '8px 6px', verticalAlign: 'top', borderTop: '1px solid #cfd8dc' };
  const inp = { padding: '8px', fontSize: 15, boxSizing: 'border-box' };
  return (
    <>
      <p className="muted">Owner account: <b>{d.owner}</b> (set in Vercel, always an admin). {msg && <b style={{ marginLeft: 8 }}>{msg}</b>}</p>
      <p><button style={{ padding: '8px 14px', fontSize: 15 }} onClick={() => share('')}>🔗 Share / copy site link</button></p>
      <div className="scroll">
        <table style={{ width: '100%' }}>
          <thead><tr><th>User</th><th>Role</th><th>Jobs they can open</th><th>New password</th><th></th></tr></thead>
          <tbody>
            {d.users.map((u) => (
              <tr key={u.username}>
                <td style={cell}><b>{u.username}</b></td>
                <td style={cell}>
                  <select style={inp} value={u.role} onChange={(e) => save({ ...u, role: e.target.value })} title={ROLE_HELP[u.role]}>
                    <option value="admin">admin</option><option value="editor">editor</option><option value="viewer">viewer</option>
                  </select>
                </td>
                <td style={cell}>{u.role === 'admin' ? <span className="muted">All jobs</span> : <JobPicker all={d.jobs} value={u.jobs || []} onChange={(jobs) => save({ ...u, jobs })} />}</td>
                <td style={cell}>
                  <input style={{ ...inp, width: 150 }} type="password" placeholder="leave empty" value={pw[u.username] || ''} onChange={(e) => setPw({ ...pw, [u.username]: e.target.value })} />
                  <button style={{ marginLeft: 6 }} disabled={!pw[u.username]} onClick={async () => { if (await save({ ...u, password: pw[u.username] })) setPw({ ...pw, [u.username]: '' }); }}>Set</button>
                </td>
                <td style={cell}><button onClick={() => share(u.username)} title="Share invite link">🔗 Invite</button> <button onClick={() => del(u.username)}>Delete</button></td>
              </tr>
            ))}
            {d.users.length === 0 && <tr><td colSpan={5} style={cell} className="muted">No other users yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <h2 style={{ marginTop: 28 }}>Add a user</h2>
      <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
        <input style={inp} placeholder="Username" autoCapitalize="none" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
        <input style={inp} type="password" placeholder="Password (8+ characters)" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
        <select style={inp} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
          <option value="viewer">viewer – {ROLE_HELP.viewer}</option>
          <option value="editor">editor – {ROLE_HELP.editor}</option>
          <option value="admin">admin – {ROLE_HELP.admin}</option>
        </select>
        {nu.role !== 'admin' && <div><div className="muted" style={{ marginBottom: 4 }}>Jobs they can open</div><JobPicker all={d.jobs} value={nu.jobs} onChange={(jobs) => setNu({ ...nu, jobs })} /></div>}
        <button style={{ padding: '10px 18px', fontSize: 16, justifySelf: 'start' }} disabled={!nu.username || nu.password.length < 8} onClick={async () => { if (await save(nu)) setNu({ username: '', password: '', role: 'viewer', jobs: [] }); }}>Add user</button>
      </div>
    </>
  );
}
