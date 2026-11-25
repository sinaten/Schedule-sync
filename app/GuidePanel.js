'use client';
import { useEffect, useRef, useState } from 'react';

// Sina (phone big button): a small chat sheet. It answers short questions and can offer to open a project: the person taps "Open".
export default function GuidePanel() {
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState(null); // { on, admin }
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef(null);
  useEffect(() => {
    const f = () => { setOpen(true); fetch('/api/guide', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setSt(j)).catch(() => {}); };
    window.addEventListener('ss-guide', f);
    return () => window.removeEventListener('ss-guide', f);
  }, []);
  useEffect(() => { if (end.current) end.current.scrollIntoView({ block: 'end' }); }, [msgs, busy, open]);
  useEffect(() => { document.body.classList.toggle('ss-guide-busy', busy); return () => document.body.classList.remove('ss-guide-busy'); }, [busy]);
  if (!open) return null;
  const flip = async () => {
    const r = await fetch('/api/guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toggle: !(st && st.on) }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setSt((s) => ({ ...s, on: j.on })); else setErr(j.error || 'Could not change');
  };
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    const next = [...msgs, { role: 'user', content: t }];
    setMsgs(next); setText(''); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setMsgs([...next, { role: 'assistant', content: j.reply || '', open: j.open || null }]);
      else if (j.error === 'off') { setSt((s) => ({ ...(s || {}), on: false })); } else setErr(j.error || 'No answer');
    } catch (e) { setErr('No connection'); }
    setBusy(false);
  };
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2000, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column', height: '33vh', minHeight: 230, border: '1px solid #e5e2d8', borderBottom: 0, boxShadow: '0 -6px 24px rgba(20,20,19,.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #efece3' }}>
          <b style={{ fontSize: 15 }}>Sina</b>
          <span style={{ flex: 1 }} />
          {st && st.admin && <button type="button" onClick={flip} style={{ fontSize: 12, marginRight: 10, border: '1px solid #e5e2d8', background: '#fff', borderRadius: 8, padding: '4px 9px', cursor: 'pointer' }}>{st.on ? 'Turn off' : 'Turn on'}</button>}
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ border: 0, background: 'none', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: '#6b675c' }}>{'×'}</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {st && st.on === false && <div style={{ fontSize: 13.5, color: '#6b675c' }}>Sina is switched off.{st.admin ? ' Tap "Turn on" above to use it (it uses tokens).' : ' An admin can turn it on.'}</div>}
          {st && st.on && !msgs.length && <div style={{ fontSize: 13.5, color: '#6b675c' }}>Tell me what you want to do, for example: I want to log an issue in Mechanical Room.</div>}
          {msgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{ maxWidth: '85%', background: m.role === 'user' ? '#f4f3ee' : '#fff', border: m.role === 'user' ? '0' : '1px solid #efece3', borderRadius: 12, padding: '8px 11px', fontSize: 14, whiteSpace: 'pre-wrap' }}>
                {m.content}
                {m.open && <a href={'/j/' + encodeURIComponent(m.open)} style={{ display: 'block', marginTop: 8, textAlign: 'center', background: '#D97757', color: '#fff', borderRadius: 8, padding: '7px 10px', textDecoration: 'none', fontSize: 13.5 }}>Open {m.open}</a>}
              </div>
            </div>
          ))}
          {busy && <div style={{ fontSize: 13, color: '#8a877b' }}>Thinking{'…'}</div>}
          {err && <div style={{ fontSize: 13, color: '#b3261e' }}>{err}</div>}
          <div ref={end} />
        </div>
        {(!st || st.on) && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid #efece3' }}>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Write to Sina" maxLength={500} style={{ flex: 1, minWidth: 0, border: '1px solid #e5e2d8', borderRadius: 10, padding: '9px 11px', fontSize: 16 }} />
            <button type="button" onClick={send} disabled={busy} style={{ border: 0, background: '#D97757', color: '#fff', borderRadius: 10, padding: '0 14px', fontSize: 14, cursor: 'pointer' }}>Send</button>
          </div>
        )}
      </div>
    </div>
  );
}
