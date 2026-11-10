'use client';
import { useEffect, useRef, useState } from 'react';

// unsharp mask on grayscale: helps jsQR with slightly out-of-focus camera frames
function sharpen(id, r, k) {
  const W = id.width, H = id.height, s = id.data, gray = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) gray[i] = s[i * 4] * 0.299 + s[i * 4 + 1] * 0.587 + s[i * 4 + 2] * 0.114;
  const tmp = new Float32Array(W * H), bl = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += gray[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = acc / (2 * r + 1);
      acc += gray[y * W + Math.min(W - 1, x + r + 1)] - gray[y * W + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      bl[y * W + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  const o = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = Math.max(0, Math.min(255, gray[i] + k * (gray[i] - bl[i])));
    o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v;
    o[i * 4 + 3] = 255;
  }
  return o;
}

export default function Scan() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timer = useRef(0);
  const [state, setState] = useState('scanning'); // scanning | found | error
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  function stop() {
    clearTimeout(timer.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  async function start() {
    setState('scanning'); setText(''); setErr('');
    try {
      const jsQR = (await import('jsqr')).default;
      let detector = null;
      try {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) { detector = null; }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      try {
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.focusMode && caps.focusMode.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      } catch (e) { /* optional */ }
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let tick = 0;
      const done = (value) => { stop(); setText(value); setState('found'); };
      const loop = async () => {
        if (!streamRef.current) return;
        if (v.videoWidth) {
          tick++;
          const w = Math.min(v.videoWidth, 1280);
          const h = Math.round(v.videoHeight / v.videoWidth * w);
          canvas.width = w; canvas.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          try {
            if (detector) {
              const found = await detector.detect(canvas);
              if (found && found.length && found[0].rawValue) { done(found[0].rawValue); return; }
            }
          } catch (e) { detector = null; }
          const id = ctx.getImageData(0, 0, w, h);
          let r = jsQR(id.data, w, h);
          if (!r && tick % 2 === 0) {
            const k = tick % 4 === 0 ? [10, 4] : [6, 3];
            r = jsQR(sharpen(id, k[0], k[1]), w, h);
          }
          if (r && r.data) { done(r.data); return; }
        }
        timer.current = setTimeout(loop, 100);
      };
      loop();
    } catch (e) {
      stop();
      setErr(e && e.name === 'NotAllowedError'
        ? 'Camera access was blocked. Allow the camera for this site and try again.'
        : 'Could not open the camera.');
      setState('error');
    }
  }

  useEffect(() => {
    const prev = document.documentElement.style.background;
    document.documentElement.style.background = '#141413';
    start();
    return () => { document.documentElement.style.background = prev; stop(); };
  }, []);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const internal = text.startsWith('/') && !text.startsWith('//')
    ? text
    : origin && text.startsWith(origin + '/') ? text.slice(origin.length) : '';

  useEffect(() => {
    if (state !== 'found' || !internal) return;
    const t = setTimeout(() => { location.href = internal; }, 700);
    return () => clearTimeout(t);
  }, [state, internal]);

  return (
    <div className="sc-wrap">
      <button type="button" className="sc-close" aria-label="Close scanner"
        onClick={() => { stop(); if (history.length > 1) history.back(); else location.href = '/'; }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAF9F5" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      {state !== 'found' && (
        <>
          <video ref={videoRef} className="sc-video" playsInline muted />
          <div className="sc-frame">
            <svg width="260" height="260" viewBox="0 0 260 260" fill="none" stroke="#D97757" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 70V32a24 24 0 0 1 24-24h38M190 8h38a24 24 0 0 1 24 24v38M252 190v38a24 24 0 0 1-24 24h-38M70 252H32a24 24 0 0 1-24-24v-38" />
            </svg>
            <p>{state === 'error' ? err : 'Point the camera at the QR code'}</p>
            {state === 'error' && <button type="button" className="sc-btn" onClick={start}>Try again</button>}
            <a className="sc-btn" href="/capture">Can't scan? Continue manually</a>
          </div>
        </>
      )}

      {state === 'found' && (
        <div className="sc-found">
          <div className="sc-tick">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
          <p className="sc-small">Code recognized</p>
          <p className="sc-code">{text}</p>
          <div className="sc-actions">
            {internal && <a className="sc-btn sc-primary" href={internal}>Open</a>}
            <button type="button" className="sc-btn" onClick={start}>Scan again</button>
            <a className="sc-btn" href="/capture">Can't scan? Continue manually</a>
          </div>
        </div>
      )}
    </div>
  );
}
