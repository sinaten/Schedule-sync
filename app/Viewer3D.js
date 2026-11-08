'use client';
import { useEffect, useRef, useState } from 'react';

const VIEWER = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/';
const CHUNK = 20 * 1024 * 1024;

function loadAssets() {
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

async function post(body) {
  const r = await fetch('/api/aps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')');
  return j;
}

// Recreates what the chosen Revit 3D view shows: only its elements, with the colours set in that view.
async function applyLook(vw, job) {
  try {
    const r = await fetch('/api/aps?look=1&job=' + encodeURIComponent(job), { cache: 'no-store' });
    const look = await r.json();
    if (!look || !look.visible) return;
    const A = window.Autodesk.Viewing;
    await new Promise((res) => {
      if (vw.model && vw.model.getInstanceTree && vw.model.getInstanceTree()) res();
      else vw.addEventListener(A.OBJECT_TREE_CREATED_EVENT, () => res(), { once: true });
    });
    vw.model.getExternalIdMapping((map) => {
      const byId = {};
      for (const k in map) byId[parseInt(k.slice(-8), 16)] = map[k];
      const dbIds = (ids) => ids.map((i) => byId[i]).filter(Boolean);
      const shown = dbIds(look.visible);
      vw.isolate(shown);
      vw.fitToView(shown);
      const T = window.THREE;
      for (const hex in look.colors) {
        const n = parseInt(hex, 16);
        const col = new T.Vector4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1);
        dbIds(look.colors[hex]).forEach((d) => vw.setThemingColor(d, col, vw.model, true));
      }
    }, () => {});
  } catch (e) {}
}

// Clicking a part opens its schedule row(s) in a popup. The popup stays until another part is picked or it is closed with the X.
async function attachPopup(vw, job, setPopup) {
  try {
    const A = window.Autodesk.Viewing;
    await new Promise((res) => {
      if (vw.model.getInstanceTree && vw.model.getInstanceTree()) res();
      else vw.addEventListener(A.OBJECT_TREE_CREATED_EVENT, () => res(), { once: true });
    });
    const rev = {};
    await new Promise((res) => vw.model.getExternalIdMapping((m) => { for (const k in m) rev[m[k]] = parseInt(k.slice(-8), 16); res(); }, () => res()));
    const tree = vw.model.getInstanceTree();
    vw.addEventListener(A.SELECTION_CHANGED_EVENT, async (e) => {
      const sel = e.dbIdArray || [];
      if (!sel.length) return; // clicking empty space keeps the current popup
      const cands = [];
      let d = sel[0];
      for (let i = 0; i < 8 && d; i++) {
        if (rev[d] != null) cands.push(String(rev[d]));
        d = tree.getNodeParentId(d);
      }
      if (!cands.length) return;
      const r = await fetch('/api/job-rows?job=' + encodeURIComponent(job) + '&ids=' + cands.join(','), { cache: 'no-store' });
      const rows = await r.json();
      for (const c of cands) {
        const m = rows.filter((x) => x.element_id === c);
        if (m.length) return setPopup({ id: c, tables: m });
      }
      setPopup({ id: cands[0], tables: [] });
    });
  } catch (e) {}
}

function show(v) {
  if (typeof v === 'boolean') return v ? '\u2713' : '';
  const s = String(v ?? '');
  const urls = s.match(/https?:\/\/[^\s,;]+/g);
  if (urls) return urls.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{ marginRight: 6, textDecoration: 'none', fontSize: 18 }}>{'\u{1F517}'}</a>);
  return s;
}

export default function Viewer3D({ job = '' }) {
  const box = useRef(null);
  const viewer = useRef(null);
  const shownUrn = useRef(null);
  const tokenRef = useRef({ token: '', expires: 0 });
  const statusRef = useRef('');
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState(null);

  async function refresh() {
    try {
      const r = await fetch('/api/aps?job=' + encodeURIComponent(job), { cache: 'no-store' });
      const j = await r.json();
      setInfo(j);
      statusRef.current = j.model ? j.model.status : 'none';
      if (j.token) tokenRef.current = { token: j.token, expires: j.expires };
    } catch (e) {
      setMsg(String(e.message || e));
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (statusRef.current !== 'success' && statusRef.current !== 'none') refresh();
    }, 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!info || !info.model || info.model.status !== 'success' || !info.token) return;
    if (shownUrn.current === info.model.urn) return;
    shownUrn.current = info.model.urn;
    let dead = false;
    loadAssets()
      .then(
        () =>
          new Promise((res) => {
            const A = window.Autodesk.Viewing;
            A.Initializer(
              { env: 'AutodeskProduction2', api: 'streamingV2', getAccessToken: (cb) => cb(tokenRef.current.token, tokenRef.current.expires) },
              res
            );
          })
      )
      .then(() => {
        if (dead || !box.current) return;
        const A = window.Autodesk.Viewing;
        if (viewer.current) viewer.current.finish();
        viewer.current = new A.GuiViewer3D(box.current);
        viewer.current.start();
        A.Document.load(
          'urn:' + info.model.urn,
          (doc) => { const node = (info.model.view && doc.getRoot().search({ type: 'geometry' }).find((n) => String(n.name()).toLowerCase() === String(info.model.view).toLowerCase())) || doc.getRoot().search({ type: 'geometry', role: '3d' })[0] || doc.getRoot().getDefaultGeometry(); const vw = viewer.current; vw.loadDocumentNode(doc, node).then(() => { applyLook(vw, job); attachPopup(vw, job, setPopup); }); },
          (code, m) => setMsg('Could not open the model: ' + m)
        );
      })
      .catch((e) => setMsg(String(e.message || e)));
    return () => {
      dead = true;
    };
  }, [info]);

  useEffect(
    () => () => {
      if (viewer.current) viewer.current.finish();
    },
    []
  );

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setMsg('Preparing upload…');
    try {
      const parts = Math.max(1, Math.ceil(file.size / CHUNK));
      const s = await post({ action: 'start', name: file.name, parts });
      for (let i = 0; i < parts; i++) {
        setMsg('Uploading ' + file.name + ': part ' + (i + 1) + ' of ' + parts);
        const r = await fetch(s.urls[i], { method: 'PUT', body: file.slice(i * CHUNK, (i + 1) * CHUNK) });
        if (!r.ok) throw new Error('Upload failed (' + r.status + ')');
      }
      setMsg('Finishing…');
      await post({ action: 'finish', key: s.key, uploadKey: s.uploadKey, name: file.name, job });
      shownUrn.current = null;
      setMsg('Uploaded. Autodesk is converting the model, this can take a few minutes.');
      await refresh();
    } catch (e) {
      setMsg(String(e.message || e));
    }
    setBusy(false);
  }

  if (!info || !info.configured) return null;
  const m = info.model;
  const ready = m && m.status === 'success';
  const wrap = { margin: '0 0 24px', border: '1px solid #cfd8dc', borderRadius: 8, background: '#fff', overflow: 'hidden' };
  const bar = { display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#16262e', color: '#fff', fontSize: 14 };
  return (
    <section style={wrap}>
      <div style={bar}>
        <strong>3D model{m ? ': ' + m.name : ''}</strong>
      </div>
      <div style={{ position: 'relative' }}>
        <div ref={box} style={{ position: 'relative', height: ready ? 480 : 0 }} />
        {popup && (
          <div style={{ maxHeight: 320, overflow: 'auto', background: '#fff', borderTop: '2px solid #16262e', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#16262e', color: '#fff' }}>
              <strong>Element {popup.id}</strong>
              <button onClick={() => setPopup(null)} aria-label="Close" style={{ background: 'none', border: 0, color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>{'\u00D7'}</button>
            </div>
            {popup.tables.length === 0 && <p style={{ margin: 0, padding: 10, color: '#546e7a' }}>No schedule row for this part.</p>}
            {popup.tables.map((tb) => (
              <div key={tb.id} style={{ padding: '8px 10px', borderTop: '1px solid #eceff1' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{tb.name}</div>
                <table><tbody>
                  {tb.columns.map((c) => (
                    <tr key={c.name}><td style={{ color: '#546e7a', paddingRight: 8, verticalAlign: 'top' }}>{c.name}</td><td>{show(tb.vals && tb.vals[c.name])}</td></tr>
                  ))}
                </tbody></table>
              </div>
            ))}
          </div>
        )}
      </div>
      {!ready && (
        <p style={{ margin: 0, padding: 16, color: '#546e7a' }}>
          {!m && 'No 3D model yet. Publish it from Revit (Schedule Sync > Publish 3D).'}
          {m && m.status === 'failed' && 'Autodesk could not convert this model. Try another file or format (IFC, NWD).'}
          {m && m.status !== 'failed' && m.status !== 'success' && 'Converting model… ' + (m.progress || '') + ' This page updates by itself.'}
        </p>
      )}
      {msg && <p style={{ margin: 0, padding: '8px 16px', color: '#546e7a', fontSize: 14 }}>{msg}</p>}
      {info.error && <p style={{ margin: 0, padding: '8px 16px', color: '#b00020', fontSize: 14 }}>{info.error}</p>}
    </section>
  );
}
