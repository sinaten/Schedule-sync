'use client';
import IssuePanel from './IssuePanel';
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

// Glass look: a colour key like "ff0000_70" means 70 % transparent in Revit. The viewer's theming colour cannot be see-through, so the material of those parts is cloned with an opacity.
function setAlpha(vw, ids, a) {
  try {
    const fl = vw.model.getFragmentList();
    const tree = vw.model.getInstanceTree();
    const mm = vw.impl.matman();
    const cache = {};
    ids.forEach((d) => tree.enumNodeFragments(d, (f) => {
      const base = fl.getMaterial(f);
      if (!base) return;
      window.__ssOrig = window.__ssOrig || new Map();
      if (!window.__ssOrig.has(f)) window.__ssOrig.set(f, base);
      const key = 'ss-' + base.uuid + '-' + a;
      let m = cache[key];
      if (!m) {
        m = base.clone();
        m.transparent = true;
        m.opacity = a;
        m.depthWrite = false;
        m.needsUpdate = true;
        try { mm.addMaterial(key, m, true); } catch (e) {}
        cache[key] = m;
      }
      fl.setMaterial(f, m);
    }, true));
    vw.impl.invalidate(true, true, true);
  } catch (e) {}
}

// Undo the colours and see-through parts, so the look can be applied again without reloading the model.
function resetLook(vw) {
  try {
    vw.clearThemingColors(vw.model);
    const fl = vw.model.getFragmentList();
    if (window.__ssOrig) {
      window.__ssOrig.forEach((m, f) => { try { fl.setMaterial(f, m); } catch (e) {} });
      window.__ssOrig.clear();
    }
    vw.showAll();
    vw.impl.invalidate(true, true, true);
  } catch (e) {}
}

// Puts the camera where the Revit view had it (position, look direction, up). Revit feet; the viewer works relative to the model's own offset.
function setCam(vw, cam) {
  try {
    const T = window.THREE;
    const off = (vw.model.getGlobalOffset && vw.model.getGlobalOffset()) || { x: 0, y: 0, z: 0 };
    const e = cam.eye, d = cam.dir, u = cam.up;
    const eye = new T.Vector3(e[0] - off.x, e[1] - off.y, e[2] - off.z);
    const tgt = new T.Vector3(eye.x + d[0] * 10, eye.y + d[1] * 10, eye.z + d[2] * 10);
    vw.navigation.setCameraUpVector(new T.Vector3(u[0], u[1], u[2]));
    vw.navigation.setView(eye, tgt);
    if (cam.persp) vw.navigation.toPerspective(); else vw.navigation.toOrthographic();
    return true;
  } catch (e) { return false; }
}

// Recreates what the chosen Revit 3D view shows: only its elements, with the colours set in that view.
async function applyLook(vw, job, layer, keepView) {
  try {
    const r = await fetch('/api/aps?look=1&job=' + encodeURIComponent(job) + (window.__ssView ? '&view=' + encodeURIComponent(window.__ssView) : ''), { cache: 'no-store' });
    let look = await r.json();
    if (!look || !look.visible) return;
    if (window.__ssView) {
      // another view: its own parts, coloured by the main view's colour codes (its own colours win where it has any)
      try {
        const rm = await fetch('/api/aps?look=1&job=' + encodeURIComponent(job), { cache: 'no-store' });
        const ml = await rm.json();
        if (ml && ml.colors) {
          const byEl = {};
          for (const hex in ml.colors) ml.colors[hex].forEach((i) => { byEl[i] = hex; });
          for (const hex in look.colors || {}) look.colors[hex].forEach((i) => { byEl[i] = hex; });
          const colors = {};
          look.visible.forEach((i) => { if (byEl[i]) (colors[byEl[i]] = colors[byEl[i]] || []).push(i); });
          look = { ...look, colors };
        }
      } catch (e) { /* keep the view's own colours */ }
    }
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
      if (!keepView || keepView === 'iso') { vw.isolate(shown); if (!keepView && !(window.__ssView && look.cam && setCam(vw, look.cam))) vw.fitToView(shown); } // 'iso': re-apply what is shown but keep the camera where the person left it
      const T = window.THREE;
      // colour per part: the real look first, then (when the person's own bar is on) their layer on top of it
      const fin = {};
      for (const hex in look.colors) look.colors[hex].forEach((i) => { fin[i] = hex; });
      if (layer && layer.look && layer.look.colors) {
        (layer.edits || []).forEach((e) => { delete fin[parseInt(e.elementId, 10)]; });
        for (const hex in layer.look.colors) layer.look.colors[hex].forEach((i) => { fin[i] = hex; });
      }
      const byHex = {};
      for (const i in fin) (byHex[fin[i]] = byHex[fin[i]] || []).push(parseInt(i, 10));
      for (const hex in byHex) {
        const [h] = hex.split('_');
        const n = parseInt(h, 16);
        const col = new T.Vector4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1);
        dbIds(byHex[hex]).forEach((d) => vw.setThemingColor(d, col, vw.model, true));
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
    if (vw.__ssSel) vw.removeEventListener(A.SELECTION_CHANGED_EVENT, vw.__ssSel);
    vw.addEventListener(A.SELECTION_CHANGED_EVENT, vw.__ssSel = async (e) => {
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
  const [draft, setDraft] = useState({});
  const [openSrc, setOpenSrc] = useState(false);
  const [openMe, setOpenMe] = useState(true);
  const [mode, setMode] = useState('user');
  const [issueOn, setIssueOn] = useState({});
  const docRef = useRef(null);
  const [curView, setCurView] = useState('');
  const [vOpen, setVOpen] = useState(false);
  const [vq, setVq] = useState('');
  const [askClear, setAskClear] = useState('');
  const [layer, setLayer] = useState({ edits: [], look: null, pending: false });
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  if (typeof window !== 'undefined') window.__ssMode = mode;
  const pollT = useRef(null);
  async function loadLayer() {
    try { const r = await fetch('/api/layer?job=' + encodeURIComponent(job), { cache: 'no-store' }); if (r.ok) { const j = await r.json(); setLayer(j); return j; } } catch (e) {}
    return null;
  }
  function pollLayer() {
    clearInterval(pollT.current);
    let n = 0;
    pollT.current = setInterval(async () => { n++; const j = await loadLayer(); if ((j && !j.pending) || n > 40) clearInterval(pollT.current); }, 3000);
  }
  useEffect(() => { loadLayer().then((j) => { if (j && j.pending) pollLayer(); }); return () => clearInterval(pollT.current); }, [job]);
  useEffect(() => {
    const vw = viewer.current;
    if (!vw || !vw.model) return;
    try { vw.clearThemingColors(vw.model); } catch (e) {}
    applyLook(vw, job, mode === 'user' ? layer : null, true);
  }, [mode, layer]);
  // the website picks up new colours from Revit by itself (the add-in sends them after every change)
  useEffect(() => {
    let last = null;
    const tm = setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch('/api/aps?look=1&job=' + encodeURIComponent(job) + (window.__ssView ? '&view=' + encodeURIComponent(window.__ssView) : ''), { cache: 'no-store' });
        const s = await r.text();
        if (last !== null && s !== last) window.dispatchEvent(new Event('ss-reload-look'));
        last = s;
      } catch (e) {}
    }, 15000);
    return () => clearInterval(tm);
  }, [job]);
  const meRef = useRef('');
  const [, setMeTick] = useState(0);
  useEffect(() => { fetch('/api/job-rows?job=' + encodeURIComponent(job) + '&ids=').then((r) => { const m = r.headers.get('x-me'); if (m) { meRef.current = decodeURIComponent(m); setMeTick(1); } }).catch(() => {}); }, [job]);
  const saveRef = useRef(null);
  saveRef.current = () => saveDraft();
  useEffect(() => { window.dispatchEvent(new CustomEvent('ss-draft', { detail: Object.keys(draft).length })); }, [draft]);
  useEffect(() => {
    const f = () => saveRef.current && saveRef.current();
    window.addEventListener('ss-save', f);
    return () => window.removeEventListener('ss-save', f);
  }, []);

  useEffect(() => {
    const f = () => { const vw = viewer.current; if (vw && vw.model) { resetLook(vw); applyLook(vw, job, modeRef.current === 'user' ? layerRef.current : null, 'iso'); } };
    window.addEventListener('ss-reload-look', f);
    return () => window.removeEventListener('ss-reload-look', f);
  }, [job]);

  // pick another Revit 3D view of this job. The model on the site is the whole building; a view is recreated from what it shows and its colours.
  async function switchView(name) {
    setVOpen(false); setVq('');
    const vw = viewer.current;
    if (!vw || !vw.model) return;
    window.__ssView = name; setCurView(name);
    resetLook(vw);
    await applyLook(vw, job, modeRef.current === 'user' ? layerRef.current : null);
  }

  async function toggle(tb, col, value) {
    setDraft((d) => ({ ...d, [tb.id + '|' + tb.element_id + '|' + col]: { id: tb.id, eid: tb.element_id, col, value } }));
  }

  async function saveDraft() {
    const items = Object.values(draft);
    let bad = '';
    for (const it of items) {
      try {
        const r = await fetch('/api/schedules/' + encodeURIComponent(it.id) + '/edits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ elementId: it.eid, col: it.col, value: it.value, layer: true }) });
        if (!r.ok) bad = it.col;
      } catch (e) { bad = it.col; }
    }
    setDraft({});
    setMsg(bad ? 'You cannot change ' + bad : 'Saved in your own layer. The main model is not changed.');
    await loadLayer();
    pollLayer();
  }

  async function refresh() {
    try {
      const r = await fetch('/api/aps?job=' + encodeURIComponent(job), { cache: 'no-store' });
      const j = await r.json();
      setInfo(j);
      statusRef.current = j.model ? (j.model.converting ? 'converting' : j.model.status) : 'none';
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
          (doc) => { const node = (info.model.view && doc.getRoot().search({ type: 'geometry' }).find((n) => String(n.name()).toLowerCase() === String(info.model.view).toLowerCase())) || doc.getRoot().search({ type: 'geometry', role: '3d' })[0] || doc.getRoot().getDefaultGeometry(); const vw = viewer.current; docRef.current = doc; vw.loadDocumentNode(doc, node).then(() => { applyLook(vw, job, modeRef.current === 'user' ? layerRef.current : null); attachPopup(vw, job, setPopup); }); },
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
        {m && m.converting && <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.85 }}>Updating: {m.converting}</span>}
      </div>
      {ready && Array.isArray(m.views) && m.views.length > 1 && (() => {
        const cur = curView || m.view || m.views[0];
        const list = m.views.filter((x) => x.toLowerCase().includes(vq.trim().toLowerCase()));
        return (
          <div style={{ position: 'relative', padding: '6px 12px 8px', zIndex: 30 }}>
            <button type="button" onClick={() => setVOpen((o) => !o)} style={{ width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 16px', border: '1.5px solid ' + (vOpen ? '#e8710a' : '#d9d5c8'), borderRadius: 20, background: '#fff', font: 'inherit', fontSize: 14, fontWeight: 600, color: '#141413', cursor: 'pointer' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ color: '#8a8576', fontWeight: 500, marginRight: 6 }}>View</span>{cur}</span>
              <span style={{ color: '#8a8576' }}>{vOpen ? '▴' : '▾'}</span>
            </button>
            {vOpen && (
              <div style={{ position: 'absolute', left: 12, right: 12, top: 52, background: '#fff', border: '1.5px solid #e8710a', borderRadius: 16, boxShadow: '0 8px 28px rgba(0,0,0,.22)', overflow: 'hidden' }}>
                <input value={vq} onChange={(e) => setVq(e.target.value)} placeholder="Search views..." style={{ display: 'block', width: 'calc(100% - 20px)', boxSizing: 'border-box', margin: 10, height: 34, border: '1.5px solid #e0dccf', borderRadius: 17, padding: '0 14px', font: 'inherit', fontSize: 14, outline: 'none' }} />
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {list.length === 0 && <div style={{ padding: '12px 16px', color: '#9a9686', fontSize: 13 }}>No view found.</div>}
                  {list.map((x) => (
                    <button key={x} type="button" onClick={() => switchView(x)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', border: 0, borderTop: '1px solid #f1ede4', background: x === cur ? '#fff7ef' : '#fff', color: x === cur ? '#e8710a' : '#141413', padding: '11px 16px', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><span>{x}</span>{x === cur && <span>{'✓'}</span>}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
      <div style={{ position: 'relative' }}>
        <div ref={box} style={{ position: 'relative', height: ready ? 480 : 0, touchAction: 'none' }} />
        {ready && (
          <div
            style={{ position: 'absolute', right: 0, top: 230, height: 170, width: 44, touchAction: 'pan-y', zIndex: 10, background: 'rgba(22,38,46,.18)', borderLeft: '1px solid rgba(22,38,46,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16262e', fontSize: 18, lineHeight: 1.1, textAlign: 'center', userSelect: 'none' }}
          >
            {'\u25B2'}<br />{'\u2195'}<br />{'\u25BC'}
          </div>
        )}
        {(() => {
          const pp0 = popup || { id: null, tables: [] };
          // what the sheet shows: Source = the real data; the person's own bar = real data + their layer + unsaved ticks
          const pp = { ...pp0, tables: pp0.tables.map((tb) => { if (mode !== 'user') return tb; const v = { ...tb.vals }; (layer.edits || []).forEach((e) => { if (e.scheduleId === tb.id && e.elementId === String(tb.element_id)) v[e.col] = e.value; }); Object.values(draft).forEach((d) => { if (d.id === tb.id && d.eid === tb.element_id) v[d.col] = d.value; }); return { ...tb, vals: v }; }) };
          if (pp.tables[0] && pp.tables[0].me) meRef.current = pp.tables[0].me;
          const me = meRef.current || 'Me';
          const locked = [];
          const mine = [];
          // the user's bar shows the parameters of the Revit group "Other" (older uploads without group info fall back to the ticks the user may change)
          const hasGroup = pp.tables.some((tb) => tb.columns.some((c) => c.group));
          pp.tables.forEach((tb) => tb.columns.forEach((c) => { const ed = (tb.editable || []).includes(c.name); if ((hasGroup ? /^other/i.test(c.group || '') : ed) && !/link|url/i.test(c.name) && !/^(\d+\s*[-.]?\s*)?issue$/i.test(String(c.name).trim())) mine.push({ tb, c, ed }); }));
          const val = (tb, c) => { const v = tb.vals && tb.vals[c.name]; return typeof v === 'boolean' ? (v ? '✓ Yes' : 'No') : show(v); };
          const SHOW_LINKS = false; // flip to true to show URL / link columns in Source
          const isLink = (tb, c) => !SHOW_LINKS && (/link|url/i.test(c.name) || /^https?:\/\//.test(String((tb.vals && tb.vals[c.name]) || '')));
          const pick = (m) => { setMode(m); setOpenSrc(m === 'source'); setOpenMe(m === 'user'); };
          const bar = (icon, title, open, setOpen, body) => (
            <div style={{ margin: '0 12px 8px', border: '1px solid #efece3', borderRadius: 14, overflow: 'hidden', background: '#fdfcf9' }}>
              <button type="button" onClick={() => (open ? setOpen(false) : pick(icon === 'lock' ? 'source' : 'user'))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: 0, background: 'none', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left', color: '#141413' }}>
                <span role="checkbox" aria-checked={mode === (icon === 'lock' ? 'source' : 'user')} onClick={(e) => { e.stopPropagation(); pick(icon === 'lock' ? 'source' : 'user'); }} style={{ width: 22, height: 22, boxSizing: 'border-box', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', border: '2px solid ' + (mode === (icon === 'lock' ? 'source' : 'user') ? '#2e9e5b' : '#c9c5b8'), background: mode === (icon === 'lock' ? 'source' : 'user') ? '#2e9e5b' : '#fff' }}>{mode === (icon === 'lock' ? 'source' : 'user') ? '\u2713' : ''}</span>
                {title}{pp.id && <span style={{ marginLeft: 14, fontWeight: 500, fontSize: 12.5, color: '#8a8576' }}>{pp.id}</span>}
                <span style={{ marginLeft: 'auto', color: '#8a8576', fontSize: 12, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>{'▾'}</span>
              </button>
              {open && <div style={{ borderTop: '1px solid #efece3' }}>{body}</div>}
            </div>
          );
          const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 14px', fontSize: 12.5, borderBottom: '1px solid #f4f2ea' };
          return (
            <div style={{ background: '#fff', borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 24px rgba(20,20,19,.12)', padding: '6px 0 12px', maxHeight: 380, overflow: 'auto', maxWidth: 520, margin: '0 auto', fontSize: 13, color: '#141413' }}>
              <div style={{ width: 38, height: 4, borderRadius: 4, background: '#d9d5c8', margin: '4px auto 8px' }} />
              <div style={{ padding: '2px 16px 10px', fontWeight: 700, fontSize: 14 }}>{pp.id ? 'Element ' + pp.id : 'No element selected'}</div>
              {pp.id && pp.tables.length === 0 && <p style={{ margin: 0, padding: '4px 16px 10px', color: '#8a8576' }}>No schedule row for this part.</p>}
              {bar('lock', 'Source', openSrc, setOpenSrc, pp.tables.length === 0 ? <div style={{ ...row, color: '#8a8576' }}>{pp.id ? 'Nothing is locked.' : 'Select a part in the model.'}</div> : pp.tables.map((tb) => (
                <div key={tb.id}>
                  <div style={{ padding: '8px 14px 4px', fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#6b675c', background: '#f6f4ec' }}>{tb.name}</div>
                  {tb.columns.filter((c) => !isLink(tb, c)).map((c) => (
                    <div key={c.name} style={row}><span>{c.name}</span><span style={{ color: '#9a9686', textAlign: 'right' }}>{val(tb, c)}</span></div>
                  ))}
                </div>
              )))}
              {bar('ok', me, openMe, setOpenMe, mine.length === 0 ? <div style={{ ...row, color: '#8a8576' }}>{pp.id ? 'Nothing to change here.' : 'Select a part in the model.'}</div> : mine.map(({ tb, c, ed }) => (
                <div key={tb.id + '|' + c.name} style={row}>
                  <span>{c.name}</span>
                  {ed ? <input type="checkbox" aria-label={c.name} checked={!!(tb.vals && tb.vals[c.name] === true)} onChange={(e) => toggle(tb, c.name, e.target.checked)} style={{ width: 22, height: 22, accentColor: '#2e9e5b' }} /> : <span style={{ color: '#9a9686', textAlign: 'right' }}>{val(tb, c)}</span>}
                </div>
              )))}
              {pp.id && (() => {
                // Issue: flags this part by setting its Yes/No parameter "Issue" in Revit (the Revit side colours it with the Issue filter)
                let isq = null;
                pp.tables.forEach((tb) => { if (!isq) { const c = tb.columns.find((x) => /^(\d+\s*[-.]?\s*)?issue$/i.test(String(x.name).trim()) && x.type === 'bool'); if (c) isq = { tb, c }; } });
                const key = isq ? isq.tb.id + '|' + isq.tb.element_id : '';
                const flagged = isq ? (key in issueOn ? issueOn[key] : !!(isq.tb.vals && isq.tb.vals[isq.c.name] === true)) : false;
                const send = async () => {
                  if (!isq) { setMsg('Add the Yes/No parameter "Issue" to a schedule in Revit, then sync.'); return; }
                  const on = !flagged;
                  setIssueOn((o) => ({ ...o, [key]: on }));
                  try {
                    const r = await fetch('/api/schedules/' + encodeURIComponent(isq.tb.id) + '/edits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ elementId: isq.tb.element_id, col: isq.c.name, value: on }) });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) { setIssueOn((o) => ({ ...o, [key]: !on })); setMsg(j.error || 'Could not set the issue.'); return; }
                    setMsg(on ? 'Issue sent to Revit. The colour follows in about a minute.' : 'Issue cleared. Revit updates in about a minute.');
                  } catch (e) { setIssueOn((o) => ({ ...o, [key]: !on })); setMsg('No connection to the website.'); }
                };
                return (
                  <div>
                    <div style={{ margin: '0 12px 6px', border: '1px solid #efece3', borderRadius: 14, background: '#fdfcf9', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 600, color: '#141413' }}>
                      <span role="checkbox" aria-checked={flagged} aria-disabled="true" style={{ width: 22, height: 22, boxSizing: 'border-box', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', border: '2px solid ' + (flagged ? '#e8710a' : '#c9c6ba'), background: flagged ? '#e8710a' : 'transparent', pointerEvents: 'none' }}>{flagged ? '\u2713' : ''}</span>
                      Issue
                      <span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: 12.5, color: flagged ? '#e8710a' : '#8a8576' }}>{flagged ? 'Flagged' : 'None'}</span>
                    </div>
                    {flagged && askClear === key ? (
                      <div role="group" aria-label="Confirm clearing the issue" style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 24px)', margin: '0 12px 8px', minHeight: 40, boxSizing: 'border-box', padding: '4px 4px 4px 14px', borderRadius: 20, border: '1.5px solid #e8710a', background: '#fff7ef' }}>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#8a4a0a', lineHeight: 1.25 }}>Are you sure you want to clear this issue?</span>
                        <span style={{ display: 'flex', background: '#f1ede4', borderRadius: 16, padding: 2, flex: 'none' }}>
                          <button type="button" onClick={() => setAskClear('')} style={{ border: 0, borderRadius: 14, padding: '6px 14px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#141413', boxShadow: '0 1px 3px rgba(20,20,19,.15)' }}>No</button>
                          <button type="button" onClick={() => { setAskClear(''); send(); }} style={{ border: 0, borderRadius: 14, padding: '6px 14px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: '#e8710a' }}>Yes</button>
                        </span>
                      </div>
                    ) : (
                      <button type="button" onClick={() => (flagged ? setAskClear(key) : send())} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: 'calc(100% - 24px)', margin: '0 12px 8px', height: 32, borderRadius: 16, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid ' + (isq ? '#e8710a' : '#d9d5c8'), background: flagged ? '#e8710a' : '#fff', color: flagged ? '#fff' : isq ? '#e8710a' : '#9a9686', boxShadow: flagged ? '0 4px 12px rgba(232,113,10,.35)' : 'none' }}>
                        <span aria-hidden="true">{'\u2691'}</span>{flagged ? 'Clear issue' : 'Issue'}
                      </button>
                    )}
                  {flagged && isq && <IssuePanel job={job} element={String(isq.tb.element_id)} onMsg={setMsg} />}
                  </div>
                );
              })()}
              {Object.keys(draft).length > 0 && (
                <button type="button" onClick={saveDraft} style={{ display: 'block', width: 'calc(100% - 24px)', margin: '2px 12px 0', height: 40, border: 0, borderRadius: 12, background: '#2e9e5b', color: '#fff', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{'✓'} Save changes</button>
              )}
            </div>
          );
        })()}
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
