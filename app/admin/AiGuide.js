'use client';
import { useEffect, useState } from 'react';

// Admin > AI: the coding guide an AI reads first (how every ID is built), plus the admin's own notes.
export default function AiGuide() {
  const [d, setD] = useState(null);
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { fetch('/api/admin/ai-guide', { cache: 'no-store' }).then((r) => r.json()).then((j) => { setD(j); setNotes(j.notes || ''); }).catch(() => setMsg('Could not load')); }, []);
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/admin/ai-guide', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes }) });
    setMsg(r.ok ? 'Saved' : 'Failed'); setTimeout(() => setMsg(''), 1500);
  }
  const pill = { font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#16262e', cursor: 'pointer' };
  if (!d) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  return (
    <div>
      <h3 style={{ margin: '0 0 4px' }}>AI guide</h3>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>How every ID is built and how to read it. It is written from the Tracking IDs settings, so it always matches them, and it is saved in the database for the AI to read first. The AI is not connected to the site yet.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" style={pill} onClick={() => { try { navigator.clipboard.writeText(d.text + (notes ? '\n\n## Admin notes\n' + notes : '')); setMsg('Copied'); setTimeout(() => setMsg(''), 1500); } catch (e) {} }}>Copy guide</button>
        {msg && <b style={{ fontSize: 12, alignSelf: 'center', color: msg === 'Failed' ? '#b00020' : '#2e7d32' }}>{msg}</b>}
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, lineHeight: 1.5, background: '#f6f8f9', border: '1px solid #e6eaed', borderRadius: 10, padding: '10px 12px', maxHeight: 420, overflow: 'auto', margin: '0 0 12px' }}>{d.text}</pre>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Your notes for the AI</div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Anything else the AI should know about the codes…" style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, borderRadius: 8, border: '1px solid #d5dce0', font: 'inherit' }} />
      <button type="button" style={{ ...pill, marginTop: 6, background: '#16262e', color: '#fff', border: 0 }} onClick={save}>Save notes</button>
    </div>
  );
}
