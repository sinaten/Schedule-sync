'use client';
import { useEffect, useRef, useState } from 'react';
import { SECOND, miniInline } from './layoutSwap';

// A second, independent Autodesk viewer fixed on the right of the Issues list (tablet landscape, desktop). It stays where it is while the cards scroll.
// It never touches the main viewer at the top of the page: it has its own model load, camera and toolbar. Remove this file and its one line in IssueList.js to take it away.
const PAD = 0.35; // margin around the element, as a share of its longest side (small)
// the six planes of an upright box -> its two corners (null when the box is turned)
function corners(pl) {
  const lo = [null, null, null], hi = [null, null, null];
  for (const p of pl) {
    const n = [p[0], p[1], p[2]];
    const k = n.findIndex((v) => Math.abs(Math.abs(v) - 1) < 1e-3);
    if (k < 0 || n.some((v, i) => i !== k && Math.abs(v) > 1e-3)) return null;
    const at = -p[3] / n[k];
    if (lo[k] === null) lo[k] = at; else hi[k] = at;
  }
  if (!lo.every((v) => v !== null) || !hi.every((v) => v !== null)) return null;
  return { min: lo.map((v, i) => Math.min(v, hi[i])), max: lo.map((v, i) => Math.max(v, hi[i])) };
}
const VIEWER = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/';
function loadAssets() {
  if (window.__apsAssets) return window.__apsAssets;
  window.__apsAssets = new Promise((resolve, reject) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = VIEWER + 'style.min.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = VIEWER + 'viewer3D.min.js'; js.onload = resolve; js.onerror = () => reject(new Error('Could not load the Autodesk viewer')); document.head.appendChild(js);
  });
  return window.__apsAssets;
}

export default function SecondViewer({ job }) {
  // show an element: zoom to it and put the section box around it (the saved one if this element has one)
  // put the box into Autodesk's tool; it may want the box in model coordinates (with the global offset) or in viewer coordinates: use the one whose cut really contains the box centre
  function place(v, e, b) {
    const T = window.THREE;
    e.activate('box');
    const c = b.getCenter(new T.Vector3());
    const off = (v.model.getGlobalOffset && v.model.getGlobalOffset()) || { x: 0, y: 0, z: 0 };
    const inside = () => { const pl = (v.getCutPlanes && v.getCutPlanes()) || []; const sg = pl.map((p) => Math.sign(p.x * c.x + p.y * c.y + p.z * c.z + p.w)); return pl.length >= 6 && sg.every((x) => x !== 0 && x === sg[0]); };
    for (const k of [0, 1, -1]) {
      const b2 = b.clone(); b2.translate(new T.Vector3(off.x * k, off.y * k, off.z * k));
      e.setSectionBox(b2);
      if (inside()) return true;
    }
    setMsg('The box could not be placed (offset ' + Math.round(off.x) + ', ' + Math.round(off.y) + ', ' + Math.round(off.z) + ').');
    return false;
  }
  // choose one of the saved section boxes for this element (temporary until Save)
  async function pickBox(bx) {
    const v = vw.current; const T = window.THREE;
    if (!v || !v.model) return;
    const cc = corners(bx.planes);
    if (!cc) { setMsg('This box is turned, so it cannot be used here.'); return; }
    try {
      const e = await v.loadExtension('Autodesk.Section');
      try { e.deactivate(); } catch (x) {}
      try { v.setCutPlanes([]); } catch (x) {}
      if (place(v, e, new T.Box3(new T.Vector3(...cc.min), new T.Vector3(...cc.max)))) setMsg('"' + bx.name + '". Change it with the arrows if you like. Save makes it this element\'s box.');
    } catch (x) { setMsg('The box could not be placed.'); }
    setOpen(false);
  }
  async function focus(element) {
    const v = vw.current; const T = window.THREE;
    if (!v || !v.model || !ids.current) return;
    const d = ids.current[parseInt(element, 10)];
    if (!d) { setMsg('Element ' + element + ' was not found in the model.'); return; }
    try {
      const e = await v.loadExtension('Autodesk.Section');
      try { e.deactivate(); } catch (x) {}
      try { v.setCutPlanes([]); } catch (x) {}
      const keep = boxes.current[element];
      const bb = new T.Box3(), tmp = new T.Box3(), fl = v.model.getFragmentList();
      v.model.getInstanceTree().enumNodeFragments(d, (f) => { fl.getWorldBounds(f, tmp); bb.union(tmp); }, true);
      if (bb.isEmpty()) { setMsg('Could not measure this element.'); return; }
      const cc = bb.getCenter(new T.Vector3()); setCtr([cc.x, cc.y, cc.z]); setOpen(false);
      let b;
      if (keep) b = new T.Box3(new T.Vector3(...keep.min), new T.Vector3(...keep.max));
      else { const sz = bb.getSize(new T.Vector3()); b = bb.clone().expandByScalar(Math.max(Math.max(sz.x, sz.y, sz.z) * PAD, 0.5)); }
      if (!place(v, e, b)) return;
      try { v.fitToView([d], v.model, true); } catch (x) {}
      setMsg(keep ? 'Saved box.' : 'Automatic box. Drag its faces, then Save.');
    } catch (x) { setMsg('The box could not be placed.'); }
  }
  const save = async () => {
    const v = vw.current;
    const c = v && v.getCutPlanes ? corners((v.getCutPlanes() || []).map((p) => [p.x, p.y, p.z, p.w])) : null;
    if (!c) { setMsg('Could not read the box. Move one of its faces and try again.'); return; }
    const r = await fetch('/api/elemsec', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, element: el, min: c.min, max: c.max }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { boxes.current = j.boxes || boxes.current; setMsg('Saved. It stays like this for this element.'); } else setMsg(j.error || 'Could not save.');
  };
  const reset = async () => {
    const r = await fetch('/api/elemsec?job=' + encodeURIComponent(job) + '&element=' + encodeURIComponent(el), { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Could not reset.'); return; }
    boxes.current = j.boxes || {}; focus(el);
  };
  const sent = useRef(null), box = useRef(null), vw = useRef(null), started = useRef(false);
  const [on, setOn] = useState(false);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');
  const [el, setEl] = useState('');
  const [can, setCan] = useState(false);
  const [saved, setSaved] = useState([]);
  const [ctr, setCtr] = useState(null);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(() => { try { const j = JSON.parse(localStorage.getItem('ss-second-size') || 'null'); if (j && j.w > 200 && j.h > 150) return j; } catch (e) {} return null; });
  const ids = useRef(null), boxes = useRef({}), cur = useRef('');
  // where the viewer is wanted: wide landscape screen, the Inspection tab (or the desktop page), and the card list in view
  useEffect(() => {
    if (!SECOND || !job) return undefined;
    const f = () => {
      const tab = document.body.getAttribute('data-ms-tab');
      const ok = miniInline() && (!tab || tab === 'issues');
      const par = sent.current && sent.current.parentElement;
      const r = par && par.getBoundingClientRect();
      setOn(ok);
      setShow(ok && !!r && r.top < window.innerHeight * 0.55 && r.bottom > window.innerHeight * 0.25);
    };
    f();
    const t = setInterval(f, 300);
    window.addEventListener('scroll', f, true); window.addEventListener('resize', f);
    return () => { clearInterval(t); window.removeEventListener('scroll', f, true); window.removeEventListener('resize', f); };
  }, [job]);
  useEffect(() => {
    if (!SECOND || !job) return undefined;
    fetch('/api/elemsec?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { boxes.current = j.boxes || {}; setCan(!!j.can); }).catch(() => {});
    fetch('/api/secbox?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => setSaved((j.boxes || []).map((x) => ({ ...x, cc: corners(x.planes) })).filter((x) => x.cc))).catch(() => {});
    const f = (e) => { const n = String((e.detail || {}).element || ''); if (!n) return; cur.current = n; setEl(n); focus(n); };
    window.addEventListener('ss-second-open', f);
    return () => window.removeEventListener('ss-second-open', f);
  }, [job]);
  // its own model, loaded once when first wanted
  useEffect(() => {
    if (!on || started.current || !box.current) return;
    started.current = true;
    (async () => {
      try {
        const j = await fetch('/api/aps?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json());
        if (!j.model || j.model.status !== 'success' || !j.token) { setMsg('No model yet.'); return; }
        await loadAssets();
        const A = window.Autodesk.Viewing;
        await new Promise((res) => A.Initializer({ env: 'AutodeskProduction2', api: 'streamingV2', getAccessToken: (cb) => cb(j.token, j.expires) }, res));
        if (!box.current) return;
        vw.current = new A.GuiViewer3D(box.current);
        vw.current.start();
        A.Document.load('urn:' + j.model.urn, (doc) => {
          const node = (j.model.view && doc.getRoot().search({ type: 'geometry' }).find((n) => String(n.name()).toLowerCase() === String(j.model.view).toLowerCase())) || doc.getRoot().search({ type: 'geometry', role: '3d' })[0] || doc.getRoot().getDefaultGeometry();
          vw.current.loadDocumentNode(doc, node).then(() => {
            try { vw.current.fitToView(); } catch (e) {}
            vw.current.model.getExternalIdMapping((map) => { const m = {}; for (const k in map) m[parseInt(k.slice(-8), 16)] = map[k]; ids.current = m; if (cur.current) focus(cur.current); }, () => {});
          });
        }, (code, m) => setMsg('Could not open the model: ' + m));
      } catch (e) { setMsg(String(e.message || e)); }
    })();
  }, [on, job]);
  useEffect(() => () => { try { if (vw.current) vw.current.finish(); } catch (e) {} vw.current = null; }, []);
  useEffect(() => { if (vw.current) { const t = setTimeout(() => { try { vw.current.resize(); } catch (e) {} }, 80); return () => clearTimeout(t); } return undefined; }, [size]);
  useEffect(() => { if (show && vw.current) { const t = setTimeout(() => { try { vw.current.resize(); } catch (e) {} }, 60); return () => clearTimeout(t); } return undefined; }, [show]);
  if (!SECOND) return null;
  return (
    <>
      <span ref={sent} style={{ display: 'none' }} />
      {on && (
        <div style={{ position: 'fixed', right: '10vw', top: '18vh', width: size ? size.w : '34vw', height: size ? size.h : '36vh', zIndex: 50, border: '2px solid #5b6b8c', borderRadius: 12, background: '#e8ebf2', overflow: 'hidden', visibility: show ? 'visible' : 'hidden', pointerEvents: show ? 'auto' : 'none' }}>
          <div ref={box} style={{ position: 'absolute', inset: 0, touchAction: 'none' }} />
          {el && open && (
            <div style={{ position: 'absolute', left: 6, right: 6, top: 40, maxHeight: '60%', overflowY: 'auto', zIndex: 7, background: '#fff', border: '1.5px solid #e8710a', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.22)', padding: 6 }}>
              {[...saved].map((x) => ({ x, has: !!ctr && ctr.every((c, i) => c >= x.cc.min[i] && c <= x.cc.max[i]) })).sort((p, q) => Number(q.has) - Number(p.has)).map(({ x, has }) => (
                <button key={x.id} type="button" onClick={() => pickBox(x)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #f1ede4', background: has ? '#fff7ef' : '#fff', padding: '8px 10px', font: 'inherit', fontSize: 13, cursor: 'pointer', color: has ? '#141413' : '#8a8576' }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span>
                  <span style={{ fontSize: 11.5, color: has ? '#2e9e5b' : '#9a9686', flex: 'none' }}>{has ? '\u2713 has this element' : 'does not have it'}</span>
                </button>
              ))}
            </div>
          )}
          {el ? (
            <div style={{ position: 'absolute', left: 6, right: 6, top: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', zIndex: 5 }}>
              <b style={{ fontSize: 12, background: 'rgba(255,255,255,.9)', borderRadius: 12, padding: '3px 10px' }}>Element {el}</b>
              <span style={{ flex: 1 }} />
              {saved.length > 0 && <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ border: '1px solid #d9d5c8', background: '#fff', borderRadius: 14, padding: '4px 12px', font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{'\u25A3'} Boxes</button>}
              {can && <button type="button" onClick={save} style={{ border: 0, background: '#e8710a', color: '#fff', borderRadius: 14, padding: '4px 14px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Save</button>}
              {can && <button type="button" onClick={reset} style={{ border: '1px solid #d9d5c8', background: '#fff', borderRadius: 14, padding: '4px 12px', font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>Reset</button>}
            </div>
          ) : <span style={{ position: 'absolute', left: 10, top: 6, fontSize: 9.5, letterSpacing: 0.4, fontWeight: 700, color: '#5b6b8c', pointerEvents: 'none' }}>3D MODEL</span>}
          <div
            role="separator" aria-label="Drag to resize the model window" title="Drag to resize"
            onPointerDown={(e) => {
              e.preventDefault(); e.stopPropagation();
              const el0 = e.currentTarget.parentElement; const r0 = el0.getBoundingClientRect();
              const sx = e.clientX, sy = e.clientY, w0 = r0.width, h0 = r0.height;
              const mv = (ev) => { const w = Math.min(Math.max(w0 + (sx - ev.clientX), 240), window.innerWidth - 24), h = Math.min(Math.max(h0 + (ev.clientY - sy), 180), window.innerHeight - 24); setSize({ w, h }); };
              const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); try { setSize((z) => { if (z) localStorage.setItem('ss-second-size', JSON.stringify(z)); return z; }); } catch (x) {} };
              window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
            }}
            style={{ position: 'absolute', left: 0, bottom: 0, width: 30, height: 30, cursor: 'nesw-resize', touchAction: 'none', zIndex: 6, background: 'linear-gradient(45deg, transparent 50%, #5b6b8c 50%, #5b6b8c 58%, transparent 58%, transparent 70%, #5b6b8c 70%, #5b6b8c 78%, transparent 78%)', borderBottomLeftRadius: 10, transform: 'scaleX(-1)' }}
          />
          {msg && <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8, fontSize: 12, color: '#6b675c' }}>{msg}</div>}
        </div>
      )}
    </>
  );
}
