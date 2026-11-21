'use client';
import { useEffect, useState } from 'react';

// Admin > Followers: the add-ins of other people that follow this site. Each has its own key, can be disconnected at any time, and can only read.
export default function Followers() {
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  const [made, setMade] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => fetch('/api/admin/followers', { cache: 'no-store' }).then((r) => r.json()).then((j) => setList(j.followers || [])).catch(() => setMsg('Could not load'));
  useEffect(() => { load(); }, []);
  async function create() {
    setMsg('');
    const r = await fetch('/api/admin/followers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMade(j); setName(''); load(); } else setMsg(j.error || 'Failed');
  }
  async function toggle(f) {
    await fetch('/api/admin/followers', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: f.id, active: !f.active }) });
    load();
  }
  const pill = { font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#16262e', cursor: 'pointer' };
  const when = (t) => (t ? new Date(t).toLocaleString() : 'never');
  return (
    <div>
      <h3 style={{ margin: '0 0 4px' }}>Followers</h3>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>Each person who gets the Follower add-in has their own key. A follower can only read from this site. Disconnect a follower at any time and its key stops working at once. Your own main key is not affected.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, for example Ali" aria-label="Follower name" style={{ padding: '6px 10px', fontSize: 14, borderRadius: 8, border: '1px solid #d5dce0' }} />
        <button type="button" style={{ ...pill, background: '#16262e', color: '#fff', border: 0 }} onClick={create}>Create key</button>
        {msg && <b style={{ fontSize: 12, alignSelf: 'center', color: '#b00020' }}>{msg}</b>}
      </div>
      {made && (
        <div style={{ border: '1px solid #f1c9a8', background: '#fff6ee', borderRadius: 10, padding: '8px 10px', marginBottom: 12, fontSize: 13 }}>
          <b>Key for {made.name}</b> (shown only once: copy it now and send it to them privately)
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, wordBreak: 'break-all', margin: '6px 0' }}>{made.key}</div>
          <button type="button" style={pill} onClick={() => { try { navigator.clipboard.writeText(made.key); } catch (e) {} }}>Copy key</button>{' '}
          <button type="button" style={pill} onClick={() => setMade(null)}>Done</button>
        </div>
      )}
      {!list ? <p className="muted" style={{ fontSize: 13 }}>Loading…</p> : list.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No followers yet.</p> : list.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #eef1f3', padding: '7px 0', flexWrap: 'wrap' }}>
          <b style={{ minWidth: 110 }}>{f.name}</b>
          <span style={{ fontSize: 12, color: f.active ? '#2e7d32' : '#b00020' }}>{f.active ? 'Connected' : 'Disconnected'}</span>
          <span style={{ fontSize: 12, color: '#8a979d', flex: 1 }}>last seen: {when(f.last_seen)}</span>
          <button type="button" style={pill} onClick={() => toggle(f)}>{f.active ? 'Disconnect' : 'Reconnect'}</button>
        </div>
      ))}
    </div>
  );
}
