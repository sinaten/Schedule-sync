'use client';
import { useEffect, useState } from 'react';

// One photo / video tile. Tapping opens a full-screen viewer with a close button, a video player and a download link.
export default function MediaItem({ url, kind, label, size = 100 }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);
  const isPhoto = kind === 'photo';
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={isPhoto ? 'Open photo' : 'Play video'}
        style={{ width: size, height: size, padding: 0, border: 0, display: 'block', cursor: 'pointer', background: isPhoto ? '#eee' : '#16262e', color: '#fff' }}>
        {isPhoto ? (
          <img src={url} alt="" loading="lazy" style={{ width: size, height: size, objectFit: 'cover', display: 'block' }} />
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 13 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="none" stroke="#fff" strokeWidth="1.5" /><path d="M10 8l6 4-6 4z" /></svg>
            <span style={{ opacity: 0.7 }}>{label}</span>
          </span>
        )}
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}
            style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', right: 14, width: 46, height: 46, borderRadius: '50%', border: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141413" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '100%', display: 'flex' }}>
            {isPhoto ? (
              <img src={url} alt="" style={{ maxWidth: '100vw', maxHeight: '86vh', objectFit: 'contain' }} />
            ) : (
              <video src={url} controls autoPlay playsInline preload="metadata" style={{ maxWidth: '100vw', maxHeight: '86vh', background: '#000' }} />
            )}
          </div>
          <a href={url} download onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 14px)', left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 15 }}>Download</a>
        </div>
      )}
    </>
  );
}
