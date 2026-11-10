'use client';
import { useEffect, useRef, useState } from 'react';

// QR scanner: opens the back camera, reads a QR code, then shows what it found.
export default function Scan() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(0);
  const [state, setState] = useState('scanning'); // scanning | found | error
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  function stop() {
    clearTimeout(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start() {
    setState('scanning');
    setText('');
    setMsg('');
    try {
      const jsQR = (await import('jsqr')).default;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (!streamRef.current) return;
        if (v.videoWidth) {
          const w = Math.min(v.videoWidth, 960);
          const h = Math.round((v.videoHeight / v.videoWidth) * w);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
          if (code && code.data) {
            stop();
            setText(code.data);
            setState('found');
            return;
          }
        }
        timerRef.current = setTimeout(tick, 120);
      };
      tick();
    } catch (e) {
      stop();
      setMsg(e && e.name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera for this site and try again.' : 'Could not open the camera.');
      setState('error');
    }
  }

  useEffect(() => {
    const prev = document.documentElement.style.background;
    document.documentElement.style.background = '#141413';
    start();
    return () => { document.documentElement.style.background = prev; stop(); };
  }, []);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const internal = text.startsWith('/') && !text.startsWith('//') ? text : origin && text.startsWith(origin + '/') ? text.slice(origin.length) : '';

  useEffect(() => {
    if (state !== 'found' || !internal) return;
    const t = setTimeout(() => { location.href = internal; }, 700);
    return () => clearTimeout(t);
  }, [state, internal]);

  return (
    <div className="sc-wrap">
      <button type="button" className="sc-close" aria-label="Close scanner" onClick={() => { stop(); history.length > 1 ? history.back() : (location.href = '/'); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAF9F5" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      {state !== 'found' && (
        <>
          <video ref={videoRef} className="sc-video" playsInline muted />
          <div className="sc-frame">
            <svg width="260" height="260" viewBox="0 0 260 260" fill="none" stroke="#D97757" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 70V32a24 24 0 0 1 24-24h38M190 8h38a24 24 0 0 1 24 24v38M252 190v38a24 24 0 0 1-24 24h-38M70 252H32a24 24 0 0 1-24-24v-38" /></svg>
            <p>{state === 'error' ? msg : 'Point the camera at the QR code'}</p>
            {state === 'error' && <button type="button" className="sc-btn" onClick={start}>Try again</button>}
            <a className="sc-btn" href="/capture">Can&apos;t scan? Continue manually</a>
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
            <a className="sc-btn" href="/capture">Can&apos;t scan? Continue manually</a>
          </div>
        </div>
      )}
    </div>
  );
}
