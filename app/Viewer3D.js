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

export default function Viewer3D() {
  const box = useRef(null);
  const viewer = useRef(null);
  const shownUrn = useRef(null);
  const tokenRef = useRef({ token: '', expires: 0 });
  const statusRef = useRef('');
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const r = await fetch('/api/aps', { cache: 'no-store' });
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
          (doc) => viewer.current.loadDocumentNode(doc, (info.model.view && doc.getRoot().search({ type: 'geometry' }).find((n) => String(n.name()).toLowerCase() === String(info.model.view).toLowerCase())) || doc.getRoot().getDefaultGeometry()),
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
      await post({ action: 'finish', key: s.key, uploadKey: s.uploadKey, name: file.name });
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
        <label style={{ cursor: busy ? 'default' : 'pointer', background: '#0f8b8d', padding: '4px 10px', borderRadius: 6, opacity: busy ? 0.6 : 1 }}>
          {m ? 'Replace model' : 'Upload model'}
          <input type="file" hidden disabled={busy} accept=".rvt,.ifc,.nwd,.nwc,.dwg,.dwfx,.fbx,.obj,.skp,.zip" onChange={(e) => upload(e.target.files[0])} />
        </label>
      </div>
      <div ref={box} style={{ position: 'relative', height: ready ? 480 : 0 }} />
      {!ready && (
        <p style={{ margin: 0, padding: 16, color: '#546e7a' }}>
          {!m && 'No 3D model yet. Use “Upload model” to add one.'}
          {m && m.status === 'failed' && 'Autodesk could not convert this model. Try another file or format (IFC, NWD).'}
          {m && m.status !== 'failed' && m.status !== 'success' && 'Converting model… ' + (m.progress || '') + ' This page updates by itself.'}
        </p>
      )}
      {msg && <p style={{ margin: 0, padding: '8px 16px', color: '#546e7a', fontSize: 14 }}>{msg}</p>}
      {info.error && <p style={{ margin: 0, padding: '8px 16px', color: '#b00020', fontSize: 14 }}>{info.error}</p>}
    </section>
  );
}
