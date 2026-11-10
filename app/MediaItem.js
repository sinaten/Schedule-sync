'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// One photo / video tile. Tap: full-screen viewer (close button, video player, download).
// Press and hold (or right-click): select the file and get a "Share link" sheet, like Dropbox.
export default function MediaItem({ url, kind, label, size = 100, id, share, canStop }) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [link, setLink] = useState(share ? '/share/file/' + share : '');
  const [msg, setMsg] = useState('');
  const [hover, setHover] = useState(false);
  const timer = useRef(0);
  const held = useRef(false);
  const start = useRef([0, 0]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !sheet) setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, sheet]);

  const canShare = !!id;
  const full = link ? (typeof location !== 'undefined' ? location.origin : '') + link : '';
  const openSheet = () => { setMsg(''); setSheet(true); };
  const down = (e) => {
    if (!canShare) return;
    held.current = false;
    start.current = [e.clientX, e.clientY];
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { held.current = true; if (navigator.vibrate) { try { navigator.vibrate(30); } catch (x) { /* optional */ } } openSheet(); }, 450);
  };
  const move = (e) => { if (Math.abs(e.clientX - start.current[0]) + Math.abs(e.clientY - start.current[1]) > 12) clearTimeout(timer.current); };
  const stop = () => clearTimeout(timer.current);
  const click = () => { if (held.current) { held.current = false; return; } setOpen(true); };

  async function makeLink() {
    setMsg('Creating link…');
    try {
      const r = await fetch('/api/media/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.error || 'Could not create the link'); return; }
      setLink(j.path);
      let ok = false;
      try { await navigator.clipboard.writeText(location.origin + j.path); ok = true; } catch (x) { /* manual copy below */ }
      setMsg(ok ? 'Link copied' : 'Link ready: tap Copy');
    } catch (x) { setMsg('Could not create the link'); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(full); setMsg('Link copied'); } catch (x) { setMsg('Press and hold the link to copy it'); }
  }
  async function unshare() {
    if (!confirm('Stop sharing this file? The old link will stop working.')) return;
    const r = await fetch('/api/media/share?id=' + encodeURIComponent(id), { method: 'DELETE' });
    if (r.ok) { setLink(''); setMsg('Sharing stopped'); } else setMsg('Not allowed');
  }
  const send = () => { try { navigator.share({ url: full }); } catch (x) { /* cancelled */ } };

  const isPhoto = kind === 'photo' || kind === 'scan';
  const btn = { font: 'inherit', fontSize: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid #d9d6cc', background: '#fff', color: '#141413', cursor: 'pointer', width: '100%' };
  return (
    <>
      <span style={{ position: 'relative', display: 'block', width: size, height: size }} onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }} onPointerLeave={() => setHover(false)}>
      <button type="button" onClick={click} onPointerDown={down} onPointerMove={move} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
        onContextMenu={(e) => { if (canShare) { e.preventDefault(); stop(); held.current = true; openSheet(); } }}
        aria-label={isPhoto ? 'Open photo' : 'Play video'}
        style={{ width: size, height: size, padding: 0, border: 0, display: 'block', cursor: 'pointer', background: isPhoto ? '#eee' : '#16262e', color: '#fff', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'manipulation' }}>
        {isPhoto ? (
          <img src={url} alt="" loading="lazy" draggable={false} style={{ width: size, height: size, objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 13 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="none" stroke="#fff" strokeWidth="1.5" /><path d="M10 8l6 4-6 4z" /></svg>
            <span style={{ opacity: 0.7 }}>{label}</span>
          </span>
        )}
        {kind === 'scan' && <span style={{ position: 'absolute', bottom: 4, right: 4, padding: '1px 6px', borderRadius: 8, background: 'rgba(20,20,19,.8)', color: '#fff', fontSize: 11 }}>QR scan</span>}
        {sheet && <span style={{ position: 'absolute', inset: 0, border: '3px solid #2f7df6', borderRadius: 8, background: 'rgba(47,125,246,.18)' }} />}
        {sheet && <span style={{ position: 'absolute', top: 5, left: 5, width: 22, height: 22, borderRadius: 11, background: '#2f7df6', color: '#fff', fontSize: 14, lineHeight: '22px' }}>&#10003;</span>}
        {link && !sheet && <span style={{ position: 'absolute', bottom: 4, left: 4, width: 20, height: 20, borderRadius: 10, background: 'rgba(20,20,19,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg></span>}
      </button>
      {hover && canShare && (
        <button type="button" aria-label="Share link" title="Share link" onClick={(e) => { e.stopPropagation(); openSheet(); }}
          style={{ position: 'absolute', top: 4, left: 4, width: 28, height: 28, borderRadius: 14, border: 0, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#141413" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
        </button>
      )}
      </span>
      {open && createPortal(
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}
            style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', right: 14, width: 46, height: 46, borderRadius: '50%', border: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141413" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          {canShare && (
            <button type="button" aria-label="Share link" onClick={(e) => { e.stopPropagation(); openSheet(); }}
              style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', left: 14, height: 46, padding: '0 16px', borderRadius: 23, border: 0, background: '#fff', color: '#141413', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', zIndex: 2 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141413" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>Share
            </button>
          )}
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '100%', display: 'flex' }}>
            {isPhoto ? (
              <img src={url} alt="" style={{ maxWidth: '100vw', maxHeight: '86vh', objectFit: 'contain' }} />
            ) : (
              <video src={url} controls autoPlay playsInline preload="metadata" style={{ maxWidth: '100vw', maxHeight: '86vh', background: '#000' }} />
            )}
          </div>
          <a href={url + (url.includes('?') ? '&' : '?') + 'dl=1'} download onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 14px)', left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 15 }}>Download</a>
        </div>
      , document.body)}
      {sheet && createPortal(
        <div onClick={() => setSheet(false)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: '#faf9f5', borderRadius: '16px 16px 0 0', padding: '16px 16px calc(env(safe-area-inset-bottom) + 16px)', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ fontSize: 16 }}>1 {isPhoto ? 'photo' : 'video'} selected</b>
              <button type="button" aria-label="Close" onClick={() => setSheet(false)} style={{ width: 36, height: 36, borderRadius: 18, border: 0, background: '#ebe9e0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#141413" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            {!link && <button type="button" style={{ ...btn, background: '#141413', color: '#fff', border: 0 }} onClick={makeLink}>Create share link</button>}
            {link && (
              <>
                <input readOnly value={full} onFocus={(e) => e.target.select()} style={{ font: 'inherit', fontSize: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid #d9d6cc', width: '100%', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={{ ...btn, background: '#141413', color: '#fff', border: 0 }} onClick={copy}>Copy link</button>
                  {typeof navigator !== 'undefined' && navigator.share && <button type="button" style={btn} onClick={send}>Send…</button>}
                </div>
                {canStop && <button type="button" style={{ ...btn, color: '#b00020' }} onClick={unshare}>Stop sharing</button>}
              </>
            )}
            {msg && <span className="muted" style={{ fontSize: 14 }}>{msg}</span>}
            <button type="button" style={btn} onClick={() => setSheet(false)}>Done</button>
          </div>
        </div>
      , document.body)}
    </>
  );
}
