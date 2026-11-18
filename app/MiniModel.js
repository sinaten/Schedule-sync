'use client';
import { useEffect, useRef, useState } from 'react';
import ModelSlot from './ModelSlot';
import { corners } from './SectionBoxes';
import { MINI, miniInline } from './layoutSwap';

// The small model window of a card: tap an element number inside the card and the model (the same one, moved here with Autodesk's own toolbar) shows that element only,
// cut by a tight section box. Drag the box faces to change it; Save keeps the box for this element, Reset goes back to the automatic one.
const pill = { border: '1px solid #d9d5c8', background: '#fff', borderRadius: 14, padding: '4px 12px', font: 'inherit', fontSize: 12.5, cursor: 'pointer', color: '#141413' };
const PAD = 0.35; // margin around the element, as a share of its longest side (small)

function elemBox(vw, el) {
  try {
    const T = window.THREE;
    const d = window.__ssById && window.__ssById[parseInt(el, 10)];
    if (!d || !vw || !vw.model) return null;
    const bb = new T.Box3(), tmp = new T.Box3();
    const fl = vw.model.getFragmentList();
    vw.model.getInstanceTree().enumNodeFragments(d, (f) => { fl.getWorldBounds(f, tmp); bb.union(tmp); }, true);
    return bb.isEmpty() ? null : bb;
  } catch (e) { return null; }
}

export default function MiniModel({ card, job, disabled }) {
  const [el, setEl] = useState('');
  const [inline, setInline] = useState(false);
  useEffect(() => { const f = () => setInline(miniInline()); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const [can, setCan] = useState(false);
  const [msg, setMsg] = useState('');
  const saved = useRef({});
  useEffect(() => {
    const f = (e) => { const d = e.detail || {}; setMsg(''); setEl(!disabled && String(d.card) === String(card) ? String(d.element) : ''); };
    window.addEventListener('ss-mini-open', f);
    return () => window.removeEventListener('ss-mini-open', f);
  }, [card, disabled]);
  useEffect(() => {
    if (!el) return undefined;
    let dead = false;
    const run = async () => {
      let boxes = {};
      try { const j = await fetch('/api/elemsec?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()); boxes = j.boxes || {}; if (!dead) setCan(!!j.can); } catch (e) {}
      saved.current = boxes;
      // wait for the model to arrive in the window and zoom to the element, then put the box around it
      setTimeout(() => place(boxes[el]), 1600);
    };
    const place = async (keep) => {
      if (dead) return;
      const vw = window.__ssViewer;
      if (!vw || !vw.model) return;
      const T = window.THREE;
      let b = null;
      if (keep) b = new T.Box3(new T.Vector3(...keep.min), new T.Vector3(...keep.max));
      else {
        const eb = elemBox(vw, el);
        if (!eb) { setMsg('Could not find this element in the model.'); return; }
        const sz = eb.getSize(new T.Vector3());
        const pad = Math.max(Math.max(sz.x, sz.y, sz.z) * PAD, 0.5);
        b = eb.clone().expandByScalar(pad);
      }
      try { const e = await vw.loadExtension('Autodesk.Section'); e.activate('box'); e.setSectionBox(b); setMsg(keep ? 'Saved box.' : 'Automatic box. Drag its faces, then Save.'); } catch (e) { setMsg('The box could not be placed.'); }
    };
    run();
    return () => { dead = true; try { const vw = window.__ssViewer; const e = vw && vw.getExtension && vw.getExtension('Autodesk.Section'); if (e && e.deactivate) e.deactivate(); if (vw) vw.setCutPlanes([]); } catch (x) {} };
  }, [el, job]);
  const save = async () => {
    const vw = window.__ssViewer;
    const c = vw && vw.getCutPlanes ? corners((vw.getCutPlanes() || []).map((p) => [p.x, p.y, p.z, p.w])) : null;
    if (!c) { setMsg('Could not read the box. Move one of its faces and try again.'); return; }
    const r = await fetch('/api/elemsec', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, element: el, min: c.min, max: c.max }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Saved. It opens like this next time.' : (j.error || 'Could not save.'));
  };
  const reset = async () => {
    const r = await fetch('/api/elemsec?job=' + encodeURIComponent(job) + '&element=' + encodeURIComponent(el), { method: 'DELETE' });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setMsg(j.error || 'Could not reset.'); return; }
    const k = el; setEl(''); setTimeout(() => setEl(k), 60); // opens again with the automatic box
  };
  const num = /^\d+$/.test(String(card));
  const btn = !inline && num && !disabled && !el && MINI && (
    <div style={{ padding: '6px 12px', borderTop: '1px solid #efece3' }}>
      <button type="button" onClick={() => { setMsg(''); setEl(String(card)); }} style={{ ...pill, display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8710a" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z" /><path d="M4 7.5 L12 12 L20 7.5 M12 12 V21" /></svg>
        Section box
      </button>
    </div>
  );
  if (!el) return btn || null;
  const head = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', flexWrap: 'wrap', background: '#fff' }}>
      <b style={{ fontSize: 12.5 }}>Element {el}</b>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#6b675c' }}>{msg}</span>
      {can && <button type="button" onClick={save} style={{ ...pill, background: '#e8710a', borderColor: '#e8710a', color: '#fff', fontWeight: 600 }}>Save</button>}
      {can && <button type="button" onClick={reset} style={pill}>Reset</button>}
      <button type="button" onClick={() => setEl('')} aria-label="Close the model window" style={pill}>{'\u2715'}</button>
    </div>
  );
  if (!inline) {
    // pop-up over the page (tablet portrait, phone): the model fills it
    return (
      <div role="dialog" aria-label="Section box" style={{ position: 'fixed', inset: 0, zIndex: 2600, background: '#fff', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', boxSizing: 'border-box' }}>
        {head}
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <ModelSlot element={el} style={{ position: 'absolute', inset: 0, borderTop: 0 }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ borderTop: '1px solid #efece3', background: '#fff' }}>
      {head}
      <div style={{ position: 'relative', height: 340 }}>
        <ModelSlot element={el} style={{ position: 'absolute', inset: 0, borderTop: 0 }} />
      </div>
    </div>
  );
}
