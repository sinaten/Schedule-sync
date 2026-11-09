'use client';
import { useEffect, useRef, useState } from 'react';

// Manual capture: used when a QR code could not be scanned. Camera preview + photo / video buttons.
// Saving is not connected yet (to be set up later).
export default function Capture() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const prev = document.documentElement.style.background;
    document.documentElement.style.background = '#141413';
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        streamRef.current = s;
        videoRef.current.srcObject = s;
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

  const soon = (what) => { setNote(what + ' saving is not set up yet'); setTimeout(() => setNote(''), 2200); };

  return (
    <div className="sc-wrap cp-wrap">
      <video ref={videoRef} className="sc-video" playsInline muted />
      <button type="button" className="sc-close" aria-label="Close" onClick={() => { history.length > 1 ? history.back() : (location.href = '/'); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAF9F5" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <div className="cp-label"><b>QR code not scanned</b><span>Manual mode</span></div>
      {err && <p className="cp-err">{err}</p>}
      {note && <p className="cp-note">{note}</p>}
      <div className="cp-bar">
        <span className="cp-sp" />
        <button type="button" className="cp-photo" aria-label="Take photo" onClick={() => soon('Photo')}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D97757" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 8h2.6l1.4-2h7l1.4 2h2.6a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.4" /></svg>
        </button>
        <button type="button" className="cp-vid" aria-label="Record video" onClick={() => soon('Video')}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97757" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="12" height="10" rx="2" /><path d="M15.5 11l5-3v8l-5-3" /></svg>
        </button>
      </div>
    </div>
  );
}
