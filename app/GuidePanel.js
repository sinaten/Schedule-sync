'use client';
import { useEffect, useRef, useState } from 'react';

// Sina (the phone's big middle button). Press once: Sina is on (the button shows the moving picture), the phone listens, Sina answers in text and aloud.
// Press again (or the X): everything stops and the button goes back to the still picture.
// Voice uses the phone's own speech tools (no extra cost); only the question text goes to the agent. Where the phone has no voice for a language, the answer stays text.
const LANGS = { en: 'en-US', fa: 'fa-IR', es: 'es-ES', zh: 'zh-CN' };
const pickLang = () => {
  try { const s = localStorage.getItem('sina-lang'); if (s && LANGS[s]) return s; } catch (e) { /* ignore */ }
  const n = String((typeof navigator !== 'undefined' && navigator.language) || 'en').slice(0, 2).toLowerCase();
  return LANGS[n] ? n : 'en';
};

export default function GuidePanel() {
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState(null); // { on, admin }
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lang, setLang] = useState('en');
  const [hear, setHear] = useState(false);
  const end = useRef(null);
  const R = useRef({ open: false, on: null, busy: false, speaking: false, msgs: [], lang: 'en', rec: null, hearing: false, timer: 0 });
  R.current.lang = lang;
  R.current.on = st ? st.on : null;
  R.current.busy = busy;
  R.current.msgs = msgs;

  const SR = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);
  const stopHear = () => { const r = R.current; clearTimeout(r.timer); r.hearing = false; setHear(false); try { if (r.rec) { r.rec.onend = null; r.rec.onresult = null; r.rec.onerror = null; r.rec.abort(); } } catch (e) { /* ignore */ } r.rec = null; };
  const startHear = () => {
    const r = R.current, C = SR();
    if (!C || !r.open || r.speaking || r.busy || r.on === false || r.hearing) return;
    try {
      const rec = new C();
      rec.lang = LANGS[r.lang] || 'en-US'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => { const t = e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript; if (t) send(String(t)); };
      rec.onerror = (e) => { r.hearing = false; setHear(false); if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) { r.open && setErr('The microphone is not allowed. You can still write.'); r.rec = null; return; } };
      rec.onend = () => { r.hearing = false; setHear(false); r.rec = null; if (r.open && !r.speaking && !r.busy) r.timer = setTimeout(startHear, 400); };
      r.rec = rec; r.hearing = true; setHear(true); rec.start();
    } catch (e) { r.hearing = false; setHear(false); }
  };
  const speak = (t) => {
    const r = R.current;
    try {
      const ss = window.speechSynthesis;
      if (!ss || !t) { startHear(); return; }
      const lc = LANGS[r.lang] || 'en-US';
      const v = ss.getVoices().find((x) => x.lang && x.lang.toLowerCase().replace('_', '-').startsWith(lc.slice(0, 2).toLowerCase()));
      if (!v && ss.getVoices().length) { startHear(); return; } // no voice on this phone for the language: the answer stays text
      const u = new SpeechSynthesisUtterance(t);
      if (v) u.voice = v;
      u.lang = lc;
      r.speaking = true; stopHear();
      u.onend = u.onerror = () => { r.speaking = false; if (r.open) startHear(); };
      ss.cancel(); ss.speak(u);
    } catch (e) { r.speaking = false; startHear(); }
  };
  async function send(raw) {
    const t = String(raw || '').trim();
    const r = R.current;
    if (!t || r.busy) return;
    const next = [...r.msgs, { role: 'user', content: t }];
    setMsgs(next); setText(''); setBusy(true); r.busy = true; setErr(''); stopHear();
    let reply = '';
    try {
      const res = await fetch('/api/guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { reply = j.reply || ''; setMsgs([...next, { role: 'assistant', content: reply, open: j.open || null }]); }
      else if (j.error === 'off') { setSt((s) => ({ ...(s || {}), on: false })); } else setErr(j.error || 'No answer');
    } catch (e) { setErr('No connection'); }
    setBusy(false); r.busy = false;
    if (R.current.open) { if (reply) speak(reply); else startHear(); }
  }
  const close = () => {
    const r = R.current; r.open = false;
    stopHear(); try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    r.speaking = false; setOpen(false);
  };
  useEffect(() => {
    setLang(pickLang());
    const f = () => {
      const r = R.current;
      if (r.open) { close(); return; }
      r.open = true; setOpen(true);
      try { const ss = window.speechSynthesis; if (ss) { ss.cancel(); ss.getVoices(); } } catch (e) { /* ignore */ }
      startHear(); // inside the tap, so the phone allows the microphone
      fetch('/api/guide', { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).then((j) => { if (j) { setSt(j); R.current.on = j.on; if (j.on === false) stopHear(); } }).catch(() => {});
    };
    window.addEventListener('ss-guide', f);
    return () => { window.removeEventListener('ss-guide', f); stopHear(); };
  }, []);
  useEffect(() => { document.body.classList.toggle('ss-guide-live', open); return () => document.body.classList.remove('ss-guide-live'); }, [open]);
  useEffect(() => { if (end.current) end.current.scrollIntoView({ block: 'end' }); }, [msgs, busy, open]);
  if (!open) return null;
  const flip = async () => {
    const r = await fetch('/api/guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toggle: !(st && st.on) }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setSt((s) => ({ ...s, on: j.on })); R.current.on = j.on; if (j.on) startHear(); else stopHear(); } else setErr(j.error || 'Could not change');
  };
  const chLang = (l) => { setLang(l); R.current.lang = l; try { localStorage.setItem('sina-lang', l); } catch (e) { /* ignore */ } stopHear(); setTimeout(startHear, 200); };
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2000, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column', height: '33vh', minHeight: 230, border: '1px solid #e5e2d8', borderBottom: 0, boxShadow: '0 -6px 24px rgba(20,20,19,.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #efece3', gap: 8 }}>
          <b style={{ fontSize: 15 }}>Sina</b>
          <span style={{ fontSize: 12, color: hear ? '#1e7a46' : '#8a877b' }}>{hear ? 'listening…' : ''}</span>
          <span style={{ flex: 1 }} />
          <select value={lang} onChange={(e) => chLang(e.target.value)} aria-label="Language" style={{ fontSize: 12, border: '1px solid #e5e2d8', borderRadius: 8, padding: '3px 4px', background: '#fff' }}>
            <option value="en">EN</option><option value="fa">FA</option><option value="es">ES</option><option value="zh">ZH</option>
          </select>
          {st && st.admin && <button type="button" onClick={flip} style={{ fontSize: 12, border: '1px solid #e5e2d8', background: '#fff', borderRadius: 8, padding: '4px 9px', cursor: 'pointer' }}>{st.on ? 'Turn off' : 'Turn on'}</button>}
          <button type="button" onClick={close} aria-label="Close" style={{ border: 0, background: 'none', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: '#6b675c' }}>{'×'}</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {st && st.on === false && <div style={{ fontSize: 13.5, color: '#6b675c' }}>Sina is switched off.{st.admin ? ' Tap "Turn on" above to use it (it uses tokens).' : ' An admin can turn it on.'}</div>}
          {st && st.on && !msgs.length && <div style={{ fontSize: 13.5, color: '#6b675c' }}>Speak or write, for example: I want to log an issue in Mechanical Room.</div>}
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
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(text); }} placeholder="Or write to Sina" maxLength={500} style={{ flex: 1, minWidth: 0, border: '1px solid #e5e2d8', borderRadius: 10, padding: '9px 11px', fontSize: 16 }} />
            <button type="button" onClick={() => send(text)} disabled={busy} style={{ border: 0, background: '#D97757', color: '#fff', borderRadius: 10, padding: '0 14px', fontSize: 14, cursor: 'pointer' }}>Send</button>
          </div>
        )}
      </div>
    </div>
  );
}
