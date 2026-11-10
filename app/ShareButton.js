'use client';
import { useEffect, useState } from 'react';

// "Share link" for one section: anyone with the link can view its photos and videos (no login).
export default function ShareButton({ sectionId }) {
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const q = '/api/share?sectionId=' + encodeURIComponent(sectionId);

  useEffect(() => {
    fetch(q).then((r) => r.json()).then((j) => setUrl(j.url || null)).catch(() => {});
  }, [sectionId]);

  async function create() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sectionId }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setUrl(j.url);
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMsg('Copied'); } catch (e) { setMsg('Select the link and copy it'); }
    setTimeout(() => setMsg(''), 2000);
  }
  async function stop() {
    if (!confirm('Stop sharing? The old link will stop working.')) return;
    setBusy(true);
    await fetch(q, { method: 'DELETE' });
    setUrl(null); setBusy(false);
  }

  const btn = { font: 'inherit', fontSize: 13, padding: '4px 10px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' };
  if (!url) return <button type="button" style={btn} onClick={create} disabled={busy}>Create share link</button>;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 8px' }}>
      <input readOnly value={url} onFocus={(e) => e.target.select()} style={{ flex: '1 1 220px', minWidth: 0, font: 'inherit', fontSize: 13, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 8 }} />
      <button type="button" style={btn} onClick={copy}>Copy</button>
      <button type="button" style={btn} onClick={stop} disabled={busy}>Stop sharing</button>
      {msg && <span className="muted" style={{ fontSize: 13 }}>{msg}</span>}
    </div>
  );
}
