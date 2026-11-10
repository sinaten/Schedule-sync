'use client';
import { useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';

// Capture screen. Opened from a section QR (?s=<id>): the job and section are known.
// Opened manually ("Can't scan?"): pick the job (and optionally a section) first.
// Every capture session becomes one visit = one folder (job / section / date-time_user), with GPS when allowed.
const sel = { flex: 1, minWidth: 0, background: 'rgba(20,20,19,.72)', color: '#FAF9F5', border: '1px solid rgba(255,255,255,.25)', borderRadius: 10, padding: '8px 10px', fontSize: 15 };
const jsonPost = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export default function Capture() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunks = useRef([]);
  const visitRef = useRef(null);
  const seq = useRef(0);
  const posRef = useRef(null);
  const proofRef = useRef(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [fixed, setFixed] = useState(false);
  const [title, setTitle] = useState('QR code not scanned');
  const [sub, setSub] = useState('Manual mode');
  const [sectionId, setSectionId] = useState('');
  const [job, setJob] = useState('');
  const [opts, setOpts] = useState({ jobs: [], sections: [] });
  const [busy, setBusy] = useState(0);
  const [saved, setSaved] = useState(0);
  const [rec, setRec] = useState(false);
  const [snap, setSnap] = useState(false);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!rec) { setSecs(0); return; }
    const t0 = Date.now();
    const iv = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(iv);
  }, [rec]);

  const flash = (m, ms = 2200) => { setNote(m); setTimeout(() => setNote(''), ms); };

  useEffect(() => {
    const prev = document.documentElement.style.background;
    document.documentElement.style.background = '#141413';
    const s = new URLSearchParams(location.search).get('s');
    (async () => {
      try {
        if (s) {
          const r = await fetch('/api/visits?section=' + encodeURIComponent(s));
          const j = await r.json();
          if (r.ok) { setFixed(true); setSectionId(s); setJob(j.section.job); setTitle(j.section.job); setSub(j.section.name); proofRef.current = sendProof(s); }
          else setErr(j.error || 'Section not found');
        } else {
          const r = await fetch('/api/visits');
          if (r.ok) setOpts(await r.json());
        }
      } catch (e) { /* ignore */ }
    })();
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => { posRef.current = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } catch (e) { /* no GPS */ }
    (async () => {
      try {
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        streamRef.current = st;
        videoRef.current.srcObject = st;
        await videoRef.current.play();
      } catch (e) {
        setErr('Could not open the camera. Allow the camera for this site.');
      }
    })();
    return () => {
      document.documentElement.style.background = prev;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Anti-cheat: the scanner keeps the camera frame it saw when it recognized the QR. It is saved first in the new folder as "scan" proof.
  async function sendProof(sid) {
    let p = null;
    try { p = JSON.parse(sessionStorage.getItem('scanproof') || 'null'); sessionStorage.removeItem('scanproof'); } catch (e) { return; }
    if (!p || p.sid !== sid || Date.now() - p.t > 120000) return;
    try {
      for (let i = 0; i < 6 && !posRef.current; i++) await new Promise((r) => setTimeout(r, 250));
      const blob = await (await fetch(p.data)).blob();
      const r = await jsonPost('/api/visits', { sectionId: sid, ...(posRef.current || {}) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not start the visit');
      visitRef.current = { ...j, key: sid };
      seq.current = 0;
      await save(blob, 'scan', 'jpg', visitRef.current);
    } catch (e) { flash('Scan photo not saved: ' + (e && e.message ? e.message : 'error'), 5000); }
  }

  async function ensureVisit() {
    if (proofRef.current) { try { await proofRef.current; } catch (e) { /* ignore */ } }
    const key = fixed ? sectionId : job + '|' + sectionId;
    if (visitRef.current && visitRef.current.key === key) return visitRef.current;
    const r = await jsonPost('/api/visits', { sectionId: sectionId || undefined, job: job || undefined, ...(posRef.current || {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Could not start the visit');
    visitRef.current = { ...j, key };
    seq.current = 0;
    return visitRef.current;
  }

  async function save(blob, kind, ext, visit) {
    setBusy((b) => b + 1);
    try {
      const n = ++seq.current;
      const path = visit.folder + '/' + String(n).padStart(3, '0') + '-' + kind + '.' + ext;
      const res = await upload(path, blob, {
        access: 'private',
        handleUploadUrl: '/api/media/upload',
        clientPayload: JSON.stringify({ visitId: visit.id }),
        contentType: blob.type || undefined,
        multipart: kind === 'video',
      });
      const r = await jsonPost('/api/media', { visitId: visit.id, pathname: res.pathname, kind, size: blob.size, contentType: blob.type });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not register the file');
      setSaved((x) => x + 1);
      flash('Saved');
    } catch (e) {
      flash('Not saved: ' + (e && e.message ? e.message : 'error'), 5000);
    } finally {
      setBusy((b) => b - 1);
    }
  }

  const needJob = () => { if (!fixed && !job) { flash('Choose a job first'); return true; } return false; };

  async function takePhoto() {
    const v = videoRef.current;
    if (needJob() || !v || !v.videoWidth) return;
    setSnap(true); setTimeout(() => setSnap(false), 250);
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* optional */ }
    try {
      const visit = await ensureVisit();
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Could not take the photo');
      save(blob, 'photo', 'jpg', visit);
    } catch (e) { flash(e.message || 'Error', 4000); }
  }

  async function toggleVideo() {
    if (rec) { if (recRef.current) recRef.current.stop(); return; }
    if (needJob() || !streamRef.current) return;
    try {
      const mime = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
      if (!mime) { flash('Video recording is not supported on this phone', 4000); return; }
      const visit = await ensureVisit();
      let mic = null;
      let rs = streamRef.current;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        rs = new MediaStream([...streamRef.current.getVideoTracks(), ...mic.getAudioTracks()]);
      } catch (e) { flash('Microphone not allowed: video will have no sound', 4000); }
      const mr = new MediaRecorder(rs, { mimeType: mime });
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data); };
      mr.onstop = () => {
        setRec(false);
        if (mic) mic.getTracks().forEach((x) => x.stop());
        const type = mime.split(';')[0];
        save(new Blob(chunks.current, { type }), 'video', type === 'video/mp4' ? 'mp4' : 'webm', visit);
      };
      mr.start();
      recRef.current = mr;
      setRec(true);
      try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* optional */ }
    } catch (e) { flash(e.message || 'Error', 4000); }
  }

  const subText = sub + (saved ? ' · ' + saved + ' saved' : '') + (busy ? ' · uploading…' : '');

  return (
    <div className="sc-wrap cp-wrap">
      <video ref={videoRef} className="sc-video" playsInline muted />
      <button type="button" className="sc-close" aria-label="Close" onClick={() => { history.length > 1 ? history.back() : (location.href = '/'); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAF9F5" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <div className="cp-label"><b>{title}</b><span>{subText}</span></div>
      {!fixed && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(env(safe-area-inset-top) + 92px)', display: 'flex', gap: 8, padding: '0 16px', zIndex: 3 }}>
          <select value={job} onChange={(e) => { setJob(e.target.value); setSectionId(''); }} style={sel} aria-label="Job">
            <option value="">Job…</option>
            {opts.jobs.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={sel} disabled={!job} aria-label="Section">
            <option value="">No section</option>
            {opts.sections.filter((s) => s.job === job).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {err && <p className="cp-err">{err}</p>}
      {note && <p className="cp-note">{note}</p>}
      <style>{`@keyframes cpPulse{0%,100%{box-shadow:0 0 0 0 rgba(231,76,60,.7)}50%{box-shadow:0 0 0 14px rgba(231,76,60,0)}}.cp-photo:active,.cp-vid:active{transform:scale(.88)}.cp-photo,.cp-vid{transition:transform .1s,background .15s}`}</style>
      {snap && <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.55, zIndex: 4, pointerEvents: 'none' }} />}
      {rec && <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(env(safe-area-inset-top) + 56px)', display: 'flex', justifyContent: 'center', zIndex: 4, pointerEvents: 'none' }}><span style={{ background: '#c0392b', color: '#fff', padding: '4px 12px', borderRadius: 14, fontSize: 14, fontWeight: 600 }}>● REC {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</span></div>}
      <div className="cp-bar">
        <span className="cp-sp" />
        <button type="button" className="cp-photo" aria-label="Take photo" onClick={takePhoto} style={snap ? { background: '#D97757' } : undefined}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D97757" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 8h2.6l1.4-2h7l1.4 2h2.6a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.4" /></svg>
        </button>
        <button type="button" className="cp-vid" aria-label={rec ? 'Stop recording' : 'Record video'} onClick={toggleVideo} style={rec ? { background: '#e74c3c', borderColor: '#e74c3c', animation: 'cpPulse 1.2s infinite' } : undefined}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={rec ? '#fff' : '#D97757'} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="12" height="10" rx="2" /><path d="M15.5 11l5-3v8l-5-3" /></svg>
        </button>
      </div>
    </div>
  );
}
