'use client';
import { useEffect, useState } from 'react';

// Small pictures of Revit views under the model. Tap one to see it large; the cross closes it.
export default function Snapshots({ job }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    let off = false;
    const load = () => fetch('/api/snap?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (!off) setList(j.snaps || []); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { off = true; clearInterval(t); };
  }, [job]);
  if (!list.length) return null;
  return (
    <>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 12px', background: '#fdfcf9' }}>
        {list.map((s) => (
          <button key={s.id} type="button" onClick={() => setOpen(s)} aria-label={s.name} style={{ flex: 'none', width: 92, padding: 0, border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }}>
            <img src={s.url} alt={s.name} style={{ width: 92, height: 62, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #e8833a', display: 'block' }} />
            <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: '#6b6759', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
          </button>
        ))}
      </div>
      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={open.url} alt={open.name} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '96vw', maxHeight: '86vh', objectFit: 'contain', borderRadius: 8, background: '#fff' }} />
          <button type="button" aria-label="Close" onClick={() => setOpen(null)} style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 12px)', right: 14, width: 44, height: 44, borderRadius: '50%', border: 0, background: '#fff', fontSize: 26, lineHeight: '40px', color: '#141413', cursor: 'pointer', padding: 0 }}>{'×'}</button>
          <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 14px)', left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 13 }}>{open.name}</div>
        </div>
      )}
    </>
  );
}
