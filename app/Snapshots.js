'use client';
import { useEffect, useRef, useState } from 'react';

const VIEWER = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/';
function assets() {
  if (window.__apsAssets) return window.__apsAssets;
  window.__apsAssets = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = VIEWER + 'style.min.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = VIEWER + 'viewer3D.min.js';
    js.onload = resolve;
    js.onerror = () => reject(new Error('Could not load the Autodesk viewer'));
    document.head.appendChild(js);
  });
  return window.__apsAssets;
}

// Colours the small IFC model with the same colour codes as the main model (matched by the Revit element number the IFC keeps in its "Tag").
async function colour(vw, job) {
  try {
    const look = await (await fetch('/api/aps?look=1&job=' + encodeURIComponent(job), { cache: 'no-store' })).json();
    if (!look || !look.colors) return;
    const byEl = {};
    for (const hex in look.colors) look.colors[hex].forEach((i) => { byEl[i] = hex; });
    if (!Object.keys(byEl).length) return;
    await new Promise((res) => {
      if (vw.model.getInstanceTree && vw.model.getInstanceTree()) res();
      else vw.addEventListener(window.Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => res(), { once: true });
    });
    const tree = vw.model.getInstanceTree();
    const ids = [];
    tree.enumNodeChildren(tree.getRootId(), (id) => { if (tree.getChildCount(id) === 0) ids.push(id); }, true);
    vw.model.getBulkProperties(ids, { propFilter: ['Tag'] }, (rs) => {
      const T = window.THREE;
      rs.forEach((r) => {
        const p = (r.properties || []).find((x) => x.displayName === 'Tag');
        if (!p) return;
        const hex = byEl[parseInt(String(p.displayValue).replace(/\D/g, ''), 10)];
        if (!hex) return;
        const c = parseInt(hex.replace('#', ''), 16);
        vw.setThemingColor(r.dbId, new T.Vector4(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1), vw.model, true);
      });
    });
  } catch (e) { /* the model still shows, just without colours */ }
}

// The small IFC model (only what the Revit view with its section box shows). One finger turns it.
function IfcView({ job, onClose }) {
  const box = useRef(null);
  const [msg, setMsg] = useState('Opening the 3D model...');
  useEffect(() => {
    let dead = false;
    let vw = null;
    (async () => {
      try {
        const info = await (await fetch('/api/aps?ifc=1&job=' + encodeURIComponent(job), { cache: 'no-store' })).json();
        if (!info.ifc || info.ifc.status !== 'success' || !info.token) { setMsg('The 3D model is not ready yet' + (info.ifc && info.ifc.progress ? ' (' + info.ifc.progress + ')' : '') + '.'); return; }
        await assets();
        const A = window.Autodesk.Viewing;
        await new Promise((res) => A.Initializer({ env: 'AutodeskProduction2', api: 'streamingV2', getAccessToken: (cb) => cb(info.token, info.expires) }, res));
        if (dead || !box.current) return;
        vw = new A.Viewer3D(box.current);
        vw.start();
        A.Document.load(
          'urn:' + info.ifc.urn,
          async (doc) => {
            const node = doc.getRoot().search({ type: 'geometry', role: '3d' })[0] || doc.getRoot().getDefaultGeometry();
            await vw.loadDocumentNode(doc, node);
            if (dead) return;
            setMsg('');
            colour(vw, job);
          },
          (code, m) => setMsg('Could not open the model: ' + m)
        );
      } catch (e) { setMsg(String(e.message || e)); }
    })();
    return () => { dead = true; try { vw && vw.finish(); } catch (e) { /* ignore */ } };
  }, [job]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3500, background: '#eceae3', touchAction: 'none' }}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      {msg && <div style={{ position: 'absolute', top: '45%', left: 0, right: 0, textAlign: 'center', color: '#6b6759', fontSize: 14 }}>{msg}</div>}
      <button type="button" aria-label="Close" onClick={onClose} style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', right: 14, width: 44, height: 44, borderRadius: '50%', border: 0, background: '#fff', fontSize: 26, lineHeight: '40px', color: '#141413', cursor: 'pointer', padding: 0, zIndex: 5 }}>{'×'}</button>
    </div>
  );
}

// Small pictures of Revit views under the model, and the small turnable 3D model. Tap one to see it large; the cross closes it.
export default function Snapshots({ job }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(null);
  const [ifc, setIfc] = useState(false);
  const [ifcOpen, setIfcOpen] = useState(false);
  useEffect(() => {
    let off = false;
    const load = () => {
      fetch('/api/snap?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (!off) setList(j.snaps || []); }).catch(() => {});
      fetch('/api/aps?ifc=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (!off) setIfc(!!(j.ifc && j.ifc.status === 'success')); }).catch(() => {});
    };
    load();
    const t = setInterval(load, 60000);
    return () => { off = true; clearInterval(t); };
  }, [job]);
  if (!list.length && !ifc) return null;
  const tile = { flex: 'none', width: 92, padding: 0, border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' };
  const cap = { display: 'block', marginTop: 3, fontSize: 10.5, color: '#6b6759', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  return (
    <>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 12px', background: '#fdfcf9' }}>
        {ifc && (
          <button type="button" onClick={() => setIfcOpen(true)} aria-label="3D model" style={tile}>
            <span style={{ width: 92, height: 62, borderRadius: 8, border: '1.5px solid #e8833a', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#e8833a' }}>3D</span>
            <span style={cap}>Turn the model</span>
          </button>
        )}
        {list.map((s) => (
          <button key={s.id} type="button" onClick={() => setOpen(s)} aria-label={s.name} style={tile}>
            <img src={s.url} alt={s.name} style={{ width: 92, height: 62, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #e8833a', display: 'block' }} />
            <span style={cap}>{s.name}</span>
          </button>
        ))}
      </div>
      {ifcOpen && <IfcView job={job} onClose={() => setIfcOpen(false)} />}
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
