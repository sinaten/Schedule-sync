'use client';
import { useEffect, useRef, useState } from 'react';

// Saved section boxes for the 3D model. "New" turns on Autodesk's own section box tool (drag the six faces), "Save" keeps the box under a name,
// and any saved box can be shown again with one tap. Self-contained: remove this file and its one line in Viewer3D.js to take it away.
const pill = { border: '1px solid #d9d5c8', background: '#fff', borderRadius: 14, padding: '5px 12px', font: 'inherit', fontSize: 12.5, cursor: 'pointer', color: '#141413' };
// The six saved planes of an upright box -> its two corners, so Autodesk's box tool (with its arrows) can be given the same box. null when the box is turned.
export const corners = (pl) => {
  const lo = [null, null, null], hi = [null, null, null];
  for (const p of pl) {
    const n = [p[0], p[1], p[2]];
    const k = n.findIndex((v) => Math.abs(Math.abs(v) - 1) < 1e-3);
    if (k < 0 || n.some((v, i) => i !== k && Math.abs(v) > 1e-3)) return null;
    const at = -p[3] / n[k]; // plane n.x + w = 0 -> the coordinate of the face
    if (lo[k] === null) lo[k] = at; else hi[k] = at; // which one is the low face is sorted out below, so the sign rule of the viewer does not matter
  }
  if (!lo.every((v) => v !== null) || !hi.every((v) => v !== null)) return null;
  return { min: lo.map((v, i) => Math.min(v, hi[i])), max: lo.map((v, i) => Math.max(v, hi[i])) };
};

export default function SectionBoxes({ job, getVw }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [can, setCan] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [shown, setShown] = useState('');
  const [msg, setMsg] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.__ssSavedCut = false; }; }, []);
  const load = async () => {
    try { const j = await fetch('/api/secbox?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()); if (alive.current) { setList(j.boxes || []); setCan(!!j.can); } } catch (e) {}
  };
  useEffect(() => { if (open) load(); }, [open, job]);
  const ext = async () => { const vw = getVw(); if (!vw) return null; try { return await vw.loadExtension('Autodesk.Section'); } catch (e) { return null; } };
  const clear = async () => {
    const vw = getVw(); const e = await ext();
    try { if (e && e.deactivate) e.deactivate(); } catch (x) {}
    window.__ssSavedCut = false;
    try { if (vw) vw.setCutPlanes([]); } catch (x) {}
  };
  const off = async () => { await clear(); setEditing(false); setShown(''); setMsg('Section box is off.'); };
  const make = async () => {
    const e = await ext();
    if (!e) { setMsg('The 3D model is not ready yet.'); return; }
    await clear();
    let ok = false;
    try { ok = e.activate('box'); if (ok === false) ok = e.activate('BOX'); } catch (x) {}
    setShown(''); setEditing(true); setName('Section box ' + (list.length + 1));
    setMsg('Drag the faces of the box, then press Save.');
  };
  const save = async () => {
    const vw = getVw();
    const pl = vw && vw.getCutPlanes ? vw.getCutPlanes() : [];
    if (!pl || !pl.length) { setMsg('Make the box first, then save.'); return; }
    const r = await fetch('/api/secbox', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, name, planes: pl.map((p) => [p.x, p.y, p.z, p.w]) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Could not save.'); return; }
    setList(j.boxes || []); setEditing(false); setMsg('Saved as "' + name + '".');
  };
  const show = async (b) => {
    const vw = getVw();
    await clear(); setEditing(false);
    try {
      const T = window.THREE;
      const c = corners(b.planes);
      const e = await ext();
      let live = false;
      if (c && e && e.setSectionBox) {
        try {
          e.activate('box'); e.setSectionBox(new T.Box3(new T.Vector3(...c.min), new T.Vector3(...c.max)));
          // safety: the tool must have made the very same cut as the saved one, otherwise the saved planes are used as they are
          const now = (vw.getCutPlanes ? vw.getCutPlanes() : []) || [];
          live = b.planes.every((p) => now.some((q) => Math.abs(q.x - p[0]) < 1e-3 && Math.abs(q.y - p[1]) < 1e-3 && Math.abs(q.z - p[2]) < 1e-3 && Math.abs(q.w - p[3]) <= 1e-3 * Math.max(1, Math.abs(p[3]))));
        } catch (x) { live = false; }
      }
      if (!live) { await clear(); vw.setCutPlanes(b.planes.map((p) => new T.Vector4(p[0], p[1], p[2], p[3]))); window.__ssSavedCut = true; }
      setShown(b.id); setMsg('Showing "' + b.name + '".' + (live ? ' Drag the faces to change it; tap the name again to go back to the saved size.' : ''));
    } catch (e) { setMsg('Could not show this box.'); }
  };
  const del = async (b) => {
    const r = await fetch('/api/secbox?job=' + encodeURIComponent(job) + '&id=' + encodeURIComponent(b.id), { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Could not delete.'); return; }
    if (shown === b.id) await off();
    setList(j.boxes || []);
  };
  return (
    <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 12, pointerEvents: 'auto', maxWidth: 'calc(100% - 16px)' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ ...pill, borderColor: (shown || editing) ? '#e8710a' : '#d9d5c8', boxShadow: '0 1px 6px rgba(0,0,0,.18)' }}>{'▣'} Section boxes</button>
      {open && (
        <div style={{ marginTop: 6, width: 260, maxWidth: '100%', boxSizing: 'border-box', background: '#fff', border: '1.5px solid #e8710a', borderRadius: 14, padding: 10, boxShadow: '0 8px 28px rgba(0,0,0,.22)', marginLeft: 'auto' }}>
          {msg && <div style={{ fontSize: 12, color: '#6b675c', marginBottom: 8 }}>{msg}</div>}
          {editing && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name of this section box" style={{ flex: 1, minWidth: 0, height: 32, border: '1.5px solid #e0dccf', borderRadius: 16, padding: '0 12px', font: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
              <button type="button" onClick={save} style={{ ...pill, background: '#e8710a', borderColor: '#e8710a', color: '#fff', fontWeight: 600 }}>Save</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {can && <button type="button" onClick={make} style={pill}>+ New</button>}
            <button type="button" onClick={off} style={pill}>Off</button>
          </div>
          {list.length === 0 && <div style={{ fontSize: 12.5, color: '#9a9686' }}>No saved section boxes yet.</div>}
          {list.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderTop: '1px solid #f1ede4' }}>
              <button type="button" onClick={() => show(b)} style={{ ...pill, flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderColor: shown === b.id ? '#e8710a' : '#d9d5c8', background: shown === b.id ? '#fff7ef' : '#fff' }}>{b.name}</button>
              {can && <button type="button" onClick={() => del(b)} aria-label={'Delete ' + b.name} style={{ ...pill, padding: '5px 9px', color: '#c0392b' }}>{'✕'}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
