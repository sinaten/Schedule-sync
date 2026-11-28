'use client';
import { useEffect, useState } from 'react';

// The AI tab: a clean "new issue" page. It only holds the fields that are needed (what is wrong, how urgent).
// Saving uses the same safe route as the old New-issue form (/api/issue, action create). Nothing old is changed or hidden.
const PR = { critical: '#c0392b', noncritical: '#e8710a' };
export default function AiIssue({ job }) {
  const [text, setText] = useState('');
  const [pr, setPr] = useState('noncritical');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const f = (e) => { const d = e.detail || {}; if (typeof d.text === 'string') setText(d.text); setPr(d.priority === 'critical' ? 'critical' : 'noncritical'); setMsg(''); };
    window.addEventListener('ss-ai-fill', f);
    return () => window.removeEventListener('ss-ai-fill', f);
  }, []);
  const ok = text.trim().length > 0 && !busy;
  const save = async () => {
    if (!ok) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, action: 'create', description: text, priority: pr }) });
      if (r.ok) { setText(''); setPr('noncritical'); setMsg('Saved. You will find it in Inspection.'); }
      else { const j = await r.json().catch(() => ({})); setMsg(j.error || 'Could not save'); }
    } catch (e) { setMsg('Could not save'); }
    setBusy(false);
  };
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '12px 16px 120px' }}>
      <div style={{ border: '1.5px solid #cdbff7', borderRadius: 14, background: '#fff', padding: 14 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 10, background: 'linear-gradient(90deg,#7F5AF0,#3B82F6)', WebkitBackgroundClip: 'text', color: 'transparent', display: 'inline-block' }}>New issue</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={5000} placeholder="What is the issue? (you can type element numbers in the text)" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e0dccf', borderRadius: 10, padding: 10, font: 'inherit', fontSize: 15, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {['critical', 'noncritical'].map((k) => (
            <button key={k} type="button" onClick={() => setPr(k)} style={{ flex: 1, border: '1.5px solid ' + (pr === k ? PR[k] : '#e0dccf'), background: pr === k ? PR[k] : '#fff', color: pr === k ? '#fff' : '#555', borderRadius: 10, padding: '8px 0', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{k === 'critical' ? 'Critical' : 'Non-critical'}</button>
          ))}
        </div>
        <button type="button" onClick={save} disabled={!ok} style={{ width: '100%', marginTop: 12, border: 0, borderRadius: 10, padding: '11px 0', background: ok ? 'linear-gradient(135deg,#7F5AF0,#3B82F6)' : '#d9d6cb', color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 600, cursor: ok ? 'pointer' : 'default' }}>{busy ? 'Saving…' : 'Save'}</button>
        {msg && <div style={{ marginTop: 10, fontSize: 13.5, color: msg.startsWith('Saved') ? '#1e9e5a' : '#c0392b' }}>{msg}</div>}
      </div>
    </div>
  );
}
