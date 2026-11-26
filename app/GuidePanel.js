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
  const [voice, setVoice] = useState(false);
  const end = useRef(null);
  const R = useRef({ open: false, on: null, busy: false, speaking: false, msgs: [], lang: 'en', rec: null, hearing: false, timer: 0, voice: false, sv: false, svOk: false, stream: null, mr: null, ctx: null, audio: null, svTimer: 0, svAbort: false });
  R.current.lang = lang;
  R.current.on = st ? st.on : null;
  R.current.busy = busy;
  R.current.msgs = msgs;

  const SR = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);
  const stopHear = () => { const r = R.current; clearTimeout(r.timer); r.hearing = false; setHear(false); try { if (r.rec) { r.rec.onend = null; r.rec.onresult = null; r.rec.onerror = null; r.rec.abort(); } } catch (e) { /* ignore */ } r.rec = null; };
  const startHear = () => {
    const r = R.current, C = SR();
    if (!C || !r.open || !r.voice || r.speaking || r.busy || r.on === false || r.hearing) return;
    try {
      const rec = new C();
      rec.lang = LANGS[r.lang] || 'en-US'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => { const t = e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript; if (t) send(String(t)); };
      rec.onerror = (e) => { r.hearing = false; setHear(false); const c = e && e.error; if (c === 'not-allowed' || c === 'service-not-allowed' || c === 'audio-capture') { r.voice = false; setVoice(false); r.rec = null; setErr(c === 'service-not-allowed' ? 'Voice typing is off on this iPhone. Settings > General > Keyboard > turn on Enable Dictation (and Siri). Code: ' + c : c === 'audio-capture' ? 'No microphone found. Code: ' + c : 'The phone blocked the microphone. Code: ' + c); } else if (c && c !== 'no-speech' && c !== 'aborted') setErr('Voice error: ' + c); };
      rec.onend = () => { r.hearing = false; setHear(false); r.rec = null; if (r.open && r.voice && !r.speaking && !r.busy) r.timer = setTimeout(startHear, 400); };
      r.rec = rec; r.hearing = true; setHear(true); rec.start();
    } catch (e) { r.hearing = false; setHear(false); }
  };

  // Server voice: the phone only records and plays; the server turns speech into text and text into speech.
  const stopSv = (killStream) => {
    const r = R.current; clearInterval(r.svTimer); r.svTimer = 0; r.svAbort = true; r.spk = (r.spk || 0) + 1;
    try { if (r.mr && r.mr.state !== 'inactive') r.mr.stop(); } catch (e) { /* ignore */ }
    r.mr = null; setHear(false);
    try { if (r.audio) { r.audio.pause(); r.audio.onended = null; } } catch (e) { /* ignore */ }
    if (killStream) { try { r.stream && r.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ } r.stream = null; try { r.ctx && r.ctx.close(); } catch (e) { /* ignore */ } r.ctx = null; }
  };
  const svListen = () => {
    const r = R.current;
    if (!r.open || !r.voice || !r.sv || r.busy || r.speaking || r.mr || !r.stream) return;
    try {
      const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
      const mt = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
      const mr = new MediaRecorder(r.stream, mt ? { mimeType: mt } : undefined);
      const chunks = []; let talked = false, lastLoud = 0; const t0 = Date.now();
      r.svAbort = false;
      const an = r.ctx.createAnalyser(); an.fftSize = 1024;
      const src = r.ctx.createMediaStreamSource(r.stream); src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        clearInterval(r.svTimer); r.svTimer = 0; try { src.disconnect(); } catch (e) { /* ignore */ }
        r.mr = null; setHear(false);
        if (r.svAbort || !r.open || !r.voice) return;
        if (!talked) { if (r.open && r.voice) setTimeout(svListen, 200); return; }
        const blob = new Blob(chunks, { type: mr.mimeType || mt || 'audio/mp4' });
        const fd = new FormData(); fd.append('audio', blob, 'clip.' + (/webm/.test(blob.type) ? 'webm' : 'm4a')); fd.append('lang', r.lang);
        setBusy(true); r.busy = true;
        let t = '';
        try {
          const res = await fetch('/api/guide/voice', { method: 'POST', body: fd });
          const j = await res.json().catch(() => ({}));
          if (res.ok) t = String(j.text || ''); else if (j.error === 'novoicekey') { setErr('Server voice is not set up yet (needs OPENAI_API_KEY in Vercel).'); r.sv = false; r.voice = false; setVoice(false); } else setErr(j.error || 'Could not hear');
        } catch (e) { setErr('No connection'); }
        setBusy(false); r.busy = false;
        if (t.trim()) send(t); else if (r.open && r.voice) setTimeout(svListen, 200);
      };
      mr.start(); r.mr = mr; setHear(true);
      r.svTimer = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let m = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i] - 128) / 128; if (v > m) m = v; }
        const now = Date.now();
        if (m > 0.06) { talked = true; lastLoud = now; }
        if ((talked && now - lastLoud > 900) || now - t0 > 25000 || (!talked && now - t0 > 12000)) { try { if (mr.state !== 'inactive') mr.stop(); } catch (e) { /* ignore */ } }
      }, 100);
    } catch (e) { setErr('Could not start recording'); r.voice = false; setVoice(false); }
  };
  const svSpeak = async (t) => {
    const r = R.current;
    const my = (r.spk = (r.spk || 0) + 1);
    const parts = []; { const raw = String(t).match(/[^.!?؟۔。！？\n]+[.!?؟۔。！？]*/g) || [String(t)]; let cur = ''; raw.forEach((x) => { cur += x; if (cur.trim().length >= 45) { parts.push(cur.trim()); cur = ''; } }); if (cur.trim()) parts.push(cur.trim()); }
    const grab = async (x) => { const res = await fetch('/api/guide/speak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: x }) }); if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Could not speak'); } return URL.createObjectURL(await res.blob()); };
    const play = (url) => new Promise((done) => { const a = r.audio || (r.audio = new Audio()); a.onended = () => { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } done(); }; a.onerror = a.onended; a.src = url; const pr = a.play(); if (pr && pr.catch) pr.catch(() => done()); });
    try {
      r.speaking = true; setHear(false);
      let nextP = grab(parts[0]);
      for (let i = 0; i < parts.length; i++) {
        const url = await nextP;
        if (i + 1 < parts.length) nextP = grab(parts[i + 1]);
        if (r.spk !== my || !r.open || !r.voice) { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } break; }
        await play(url);
        if (r.spk !== my) break;
      }
    } catch (e) { setErr(String((e && e.message) || 'The phone did not play the sound')); }
    if (r.spk === my) { r.speaking = false; if (r.open && r.voice) svListen(); }
  };
  const resume = () => { if (R.current.sv) svListen(); else startHear(); };
  const speak = (t) => {
    const r = R.current;
    try {
      const ss = window.speechSynthesis;
      if (!ss || !t) { resume(); return; }
      const lc = LANGS[r.lang] || 'en-US';
      const v = ss.getVoices().find((x) => x.lang && x.lang.toLowerCase().replace('_', '-').startsWith(lc.slice(0, 2).toLowerCase()));
      if (!v && ss.getVoices().length) { resume(); return; } // no voice on this phone for the language: the answer stays text
      const u = new SpeechSynthesisUtterance(t);
      if (v) u.voice = v;
      u.lang = lc;
      r.speaking = true; stopHear();
      u.onend = u.onerror = () => { r.speaking = false; if (r.open && r.voice) resume(); };
      ss.cancel(); ss.speak(u);
    } catch (e) { r.speaking = false; resume(); }
  };
  async function send(raw) {
    const t = String(raw || '').trim();
    const r = R.current;
    if (!t || r.busy) return;
    const next = [...r.msgs, { role: 'user', content: t }];
    setMsgs(next); setText(''); setBusy(true); r.busy = true; setErr(''); stopHear(); stopSv(false);
    let reply = '';
    try {
      const res = await fetch('/api/guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: r.lang, messages: next.map((m) => ({ role: m.role, content: m.content })) }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { reply = j.reply || ''; setMsgs([...next, { role: 'assistant', content: reply, open: j.open || null }]); }
      else if (j.error === 'off') { setSt((s) => ({ ...(s || {}), on: false })); } else setErr(j.error || 'No answer');
    } catch (e) { setErr('No connection'); }
    setBusy(false); r.busy = false;
    if (R.current.open && R.current.voice) { if (reply) { if (R.current.sv) svSpeak(reply); else speak(reply); } else resume(); }
  }
  const close = () => {
    const r = R.current; r.open = false;
    stopHear(); stopSv(true); try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    r.speaking = false; r.voice = false; setVoice(false); setOpen(false);
  };
  const toggleVoice = () => {
    const r = R.current;
    if (r.voice) { r.voice = false; setVoice(false); stopHear(); stopSv(true); try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } r.speaking = false; return; }
    if (r.on === false) return;
    setErr('');
    if (r.svOk && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder) {
      // server voice: unlock the sound player and open the microphone inside this tap
      r.voice = true; setVoice(true); r.sv = true;
      try { const a = r.audio || (r.audio = new Audio()); a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='; const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* ignore */ }
      try { const AC = window.AudioContext || window.webkitAudioContext; r.ctx = new AC(); if (r.ctx.resume) r.ctx.resume(); } catch (e) { /* ignore */ }
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stm) => { r.stream = stm; if (r.voice) svListen(); else stm.getTracks().forEach((t) => t.stop()); }).catch((e) => { r.voice = false; setVoice(false); r.sv = false; setErr('The phone did not give the microphone (' + (e && e.name ? e.name : 'blocked') + ').'); });
      return;
    }
    r.sv = false;
    if (!SR()) { setErr('This phone cannot listen in the browser. You can write.'); return; }
    r.voice = true; setVoice(true);
    try { const ss = window.speechSynthesis; if (ss) { ss.cancel(); ss.getVoices(); } } catch (e) { /* ignore */ }
    startHear();
  };
  useEffect(() => {
    setLang(pickLang());
    const f = () => {
      const r = R.current;
      if (r.open) { close(); return; }
      r.open = true; setOpen(true);
      try { const ss = window.speechSynthesis; if (ss) { ss.cancel(); ss.getVoices(); } } catch (e) { /* ignore */ }
      fetch('/api/guide', { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).then((j) => { if (j) { setSt(j); R.current.on = j.on; R.current.svOk = !!j.voice; if (j.on === false) { stopHear(); stopSv(true); R.current.voice = false; setVoice(false); } } }).catch(() => {});
    };
    window.addEventListener('ss-guide', f);
    return () => { window.removeEventListener('ss-guide', f); stopHear(); stopSv(true); };
  }, []);
  const [bot, setBot] = useState(0);
  useEffect(() => {
    if (!open) return undefined;
    const m = () => { const b = document.querySelector('.ms-bot'); if (b && getComputedStyle(b).display !== 'none') { const t = b.getBoundingClientRect().top; setBot(Math.max(0, Math.round(window.innerHeight - t + 6))); } else setBot(0); };
    m(); const t1 = setTimeout(m, 80), t2 = setTimeout(m, 400);
    window.addEventListener('resize', m);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', m); };
  }, [open]);
  useEffect(() => { document.body.classList.toggle('ss-guide-open', open); document.body.classList.toggle('ss-guide-live', open && voice); return () => { document.body.classList.remove('ss-guide-open'); document.body.classList.remove('ss-guide-live'); }; }, [open, voice]);
  useEffect(() => { if (end.current) end.current.scrollIntoView({ block: 'end' }); }, [msgs, busy, open]);
  if (!open) return null;
  const flip = async () => {
    const r = await fetch('/api/guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toggle: !(st && st.on) }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setSt((s) => ({ ...s, on: j.on })); R.current.on = j.on; if (!j.on) { stopHear(); stopSv(true); R.current.voice = false; setVoice(false); } } else setErr(j.error || 'Could not change');
  };
  const chLang = (l) => { setLang(l); R.current.lang = l; setMsgs([]); R.current.msgs = []; setErr(''); try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } R.current.speaking = false; if (R.current.sv) { stopSv(false); if (R.current.voice) setTimeout(svListen, 250); } try { localStorage.setItem('sina-lang', l); } catch (e) { /* ignore */ } stopHear(); if (R.current.voice && !R.current.sv) setTimeout(startHear, 200); };
  return (
    <div className="sina-wrap" style={{ position: 'fixed', left: 0, right: 0, bottom: bot ? bot : 'calc(var(--ms-sm, 44px) + 28px + env(safe-area-inset-bottom))', zIndex: 2000, pointerEvents: 'none' }}>
      <div className="sina-box" style={{ pointerEvents: 'auto', width: '100%', maxWidth: 560, background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column', height: '46vh', minHeight: 280, border: '1px solid #e5e2d8', boxShadow: '0 -6px 24px rgba(20,20,19,.14)', margin: '0 auto 6px' }}>
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
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              {m.role === 'user' ? <div style={{ fontSize: 11, fontWeight: 500, color: '#6b675c', textAlign: 'right', marginBottom: 2 }}>{(st && st.name) || 'You'}</div> : <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 2, background: 'linear-gradient(90deg,#7F5AF0,#3B82F6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', width: 'fit-content' }}>Sina AI</div>}
              <div style={{ maxWidth: '85%', background: m.role === 'user' ? '#f4f3ee' : '#fff', border: m.role === 'user' ? '0' : '1.5px solid #7F5AF0', borderRadius: 12, padding: '8px 11px', fontSize: 14, whiteSpace: 'pre-wrap' }}>
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
          <div className="sina-in" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 10px 10px', background: '#f4f3ee', borderRadius: 22, padding: '5px 6px 5px 10px' }}>
            <button type="button" aria-label="Add file" onClick={() => setErr('Files and photos are coming soon.')} style={{ border: 0, background: 'none', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: '#6b675c', padding: 0 }}>+</button>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(text); }} placeholder="Write to Sina" maxLength={500} style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', padding: '6px 2px', fontSize: 16 }} />
            {text.trim() ? (
              <button type="button" aria-label="Send" onClick={() => send(text)} disabled={busy} style={{ width: 34, height: 34, border: 0, borderRadius: '50%', background: 'linear-gradient(135deg,#7F5AF0,#3B82F6)', color: '#fff', fontSize: 18, cursor: 'pointer', flex: 'none' }}>{'\u2191'}</button>
            ) : (
              <button type="button" aria-label={voice ? 'Stop voice' : 'Start voice'} onClick={toggleVoice} className={voice ? 'sina-wave on' : 'sina-wave'} style={{ width: 34, height: 34, border: 0, borderRadius: '50%', background: 'linear-gradient(135deg,#7F5AF0,#3B82F6)', cursor: 'pointer', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0 }}><b /><b /><b /><b /></button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
