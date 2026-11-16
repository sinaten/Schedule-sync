'use client';
import IssuePanel from './IssuePanel';
import Snapshots from './Snapshots';
import CamViews from './CamViews';
import { linkNums } from './ElemLinks';
import { useEffect, useRef, useState } from 'react';
import { fadeColor } from '../lib/fade';

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

// The part's colour as the 3D model itself has it (from Revit's export). Used when the add-in sends no material colour for a part:
// ducts, pipes, cable trays… get their colour from their System Type in Revit, which the add-in does not read, but the model has it.
// Of the part's pieces, the most colourful one wins (plain greys are the default/edge pieces). Remembered per model.
function modelColor(vw, dbId) {
  try {
    const m = vw.model;
    if (!m.__ssCol) m.__ssCol = new Map();
    if (m.__ssCol.has(dbId)) return m.__ssCol.get(dbId);
    const fl = m.getFragmentList(), tree = m.getInstanceTree();
    let best = null, bestSat = -1;
    tree.enumNodeFragments(dbId, (f) => {
      const mt = (window.__ssOrig && window.__ssOrig.get(f)) || fl.getMaterial(f);
      if (!mt || !mt.color) return;
      const c = mt.color, mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
      const sat = mx - mn;
      if (sat > bestSat) { bestSat = sat; best = mt.color.getHexString(); }
    }, true);
    m.__ssCol.set(dbId, best);
    return best;
  } catch (e) { return null; }
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
    try { vw.setCutPlanes([]); } catch (e) {}
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
    // Guard: when the camera is far from the model, or does not face it, do not use it (the caller then fits the model in the screen)
    try {
      const bb = vw.model.getBoundingBox();
      if (bb) {
        const dx = Math.max(bb.min.x - eye.x, 0, eye.x - bb.max.x), dy = Math.max(bb.min.y - eye.y, 0, eye.y - bb.max.y), dz = Math.max(bb.min.z - eye.z, 0, eye.z - bb.max.z);
        const out = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const diag = bb.min.distanceTo(bb.max);
        if (out > diag * 0.5) return false;
        if (out > 0) {
          const c = new T.Vector3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2).sub(eye);
          const len = c.length();
          if (len > 0 && (c.x * d[0] + c.y * d[1] + c.z * d[2]) / len < 0.26) return false;
        }
      }
    } catch (e2) { /* no box: use the camera as it is */ }
    const tgt = new T.Vector3(eye.x + d[0] * 10, eye.y + d[1] * 10, eye.z + d[2] * 10);
    vw.navigation.setCameraUpVector(new T.Vector3(u[0], u[1], u[2]));
    vw.navigation.setView(eye, tgt);
    if (cam.persp) vw.navigation.toPerspective(); else vw.navigation.toOrthographic();
    return true;
  } catch (e) { return false; }
}

// Cuts the model with the Revit section box (six planes), so nothing outside the box shows at all. Add ?nocut=1 to the address to switch it off, ?cutflip=1 if it cuts the wrong side.
function applyCut(vw, box) {
  try {
    const q = new URLSearchParams(window.location.search);
    if (!box || !q.get('cut')) { vw.setCutPlanes([]); return; } // switched off for now: add ?cut=1 to the address to try it
    const T = window.THREE;
    const off = (vw.model.getGlobalOffset && vw.model.getGlobalOffset()) || { x: 0, y: 0, z: 0 };
    const o = [box.o[0] - off.x, box.o[1] - off.y, box.o[2] - off.z];
    const flip = q.get('cutflip') ? -1 : 1;
    const planes = [];
    [[box.bx, 0], [box.by, 1], [box.bz, 2]].forEach(([a, k]) => {
      const od = o[0] * a[0] + o[1] * a[1] + o[2] * a[2];
      planes.push(new T.Vector4(flip * a[0], flip * a[1], flip * a[2], flip * (-od - box.min[k])));
      planes.push(new T.Vector4(-flip * a[0], -flip * a[1], -flip * a[2], -flip * (od + box.max[k])));
    });
    vw.setCutPlanes(planes);
  } catch (e) {}
}

// Turns the camera to the direction the Revit view looks in, but keeps the distance the fit-to-screen chose, so the model is always in view.
function orient(vw, cam, origin) {
  try {
    const T = window.THREE;
    const nav = vw.navigation;
    const pos0 = nav.getPosition();
    const cur = nav.getTarget();
    const dist = pos0.distanceTo(cur);
    let tgt = cur;
    if (origin) { const off = (vw.model.getGlobalOffset && vw.model.getGlobalOffset()) || { x: 0, y: 0, z: 0 }; tgt = new T.Vector3(origin[0] - off.x, origin[1] - off.y, origin[2] - off.z); }
    const d = cam ? new T.Vector3(cam.dir[0], cam.dir[1], cam.dir[2]).normalize() : new T.Vector3(cur.x - pos0.x, cur.y - pos0.y, cur.z - pos0.z).normalize();
    if (cam) nav.setCameraUpVector(new T.Vector3(cam.up[0], cam.up[1], cam.up[2]));
    nav.setView(new T.Vector3(tgt.x - d.x * dist, tgt.y - d.y * dist, tgt.z - d.z * dist), tgt);
  } catch (e) { /* keep the fitted camera */ }
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
    let site = null;
    try { const rc = await fetch('/api/colorrules?job=' + encodeURIComponent(job) + '&compute=1' + (layer ? '&layer=1' : ''), { cache: 'no-store' }); if (rc.ok) site = await rc.json(); } catch (e) { /* no site colours: Revit's own colours stay */ }
    let fade = null;
    try { const rf = await fetch('/api/fade', { cache: 'no-store' }); if (rf.ok) fade = (await rf.json()).settings; } catch (e) { /* default fade */ }
    const A = window.Autodesk.Viewing;
    await new Promise((res) => {
      if (vw.model && vw.model.getInstanceTree && vw.model.getInstanceTree()) res();
      else vw.addEventListener(A.OBJECT_TREE_CREATED_EVENT, () => res(), { once: true });
    });
    vw.model.getExternalIdMapping((map) => {
      const byId = {};
      for (const k in map) byId[parseInt(k.slice(-8), 16)] = map[k];
      window.__ssById = byId;
      window.dispatchEvent(new Event('ss-byid'));
      const dbIds = (ids) => ids.map((i) => byId[i]).filter(Boolean);
      const shown = dbIds(look.visible);
      applyCut(vw, look.box);
      try { vw.setGhosting(false); } catch (e) { /* hidden parts disappear completely, no glass */ }
      if (!keepView || keepView === 'iso') { vw.isolate(shown); if (!keepView) { vw.fitToView(shown, vw.model, true); if ((window.__ssView && look.cam) || look.origin) orient(vw, look.cam, look.origin); } } // 'iso': re-apply what is shown but keep the camera where the person left it
      const T = window.THREE;
      // colour per part: the real look first, then (when the person's own bar is on) their layer on top of it
      const fin = {};
      for (const hex in look.colors) look.colors[hex].forEach((i) => { fin[i] = hex; });
      if (layer && layer.look && layer.look.colors) {
        (layer.edits || []).forEach((e) => { delete fin[parseInt(e.elementId, 10)]; });
        for (const hex in layer.look.colors) layer.look.colors[hex].forEach((i) => { fin[i] = hex; });
      }
      // the website works the colours out itself from the colour rules: a part with a filter gets that colour, every other part is grey
      if (site && site.has) {
        for (const k in fin) delete fin[k];
        for (const hex in site.colors) site.colors[hex].forEach((i) => { fin[i] = hex; });
        const mat = {};
        for (const hex in look.matColors || {}) look.matColors[hex].forEach((i) => { mat[i] = hex; });
        look.visible.forEach((i) => { if (!fin[i]) fin[i] = fadeColor(mat[i] || (byId[i] ? modelColor(vw, byId[i]) : null), fade); }); // no filter: own Revit colour (or the model's own), faded toward white
      }
      if (window.__ssNormal) { try { vw.clearThemingColors(vw.model); vw.impl.invalidate(true, true, true); } catch (e) {} return; } // Normal view: the model's own colours, nothing painted over
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
      // a scanned camera view is for looking only: a click just shows the part's number with a Copy button
      if (window.__ssKiosk) { window.dispatchEvent(new CustomEvent('ss-kiosk-pick', { detail: cands[0] })); return; }
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

export default function Viewer3D({ job = '', kiosk = null }) {
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
  const [mode, setMode] = useState(() => { try { return (typeof window !== 'undefined' && localStorage.getItem('ss-mode:' + job)) === 'source' ? 'source' : 'user'; } catch (e) { return 'user'; } });
  const [issueOn, setIssueOn] = useState({});
  const docRef = useRef(null);
  const [curView, setCurView] = useState(() => { try { return (typeof window !== 'undefined' && localStorage.getItem('ss-view:' + job)) || ''; } catch (e) { return ''; } });
  if (typeof window !== 'undefined' && !window.__ssViewInit) { window.__ssViewInit = job; try { const v = localStorage.getItem('ss-view:' + job); if (v && !window.__ssView) window.__ssView = v; } catch (e) {} }
  const [vOpen, setVOpen] = useState(false);
  const [vq, setVq] = useState('');
  const [askClear, setAskClear] = useState('');
  const [layer, setLayer] = useState({ edits: [], look: null, pending: false });
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  if (typeof window !== 'undefined') { window.__ssMode = mode; try { localStorage.setItem('ss-mode:' + job, mode); } catch (e) {} }
  const pollT = useRef(null);
  async function loadLayer() {
    try { const r = await fetch('/api/layer?job=' + encodeURIComponent(job), { cache: 'no-store' }); if (r.ok) { const j = await r.json(); setLayer(j); return j; } } catch (e) {}
    return null;
  }
  useEffect(() => { loadLayer(); }, [job]); // no 3 s timer: the layer is read when the page opens and after a save
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

  // The Timeline (Admin > Analysis) paints the model itself: detail.fin = { partId: 'rrggbb' }
  useEffect(() => {
    const f = (ev) => {
      const vw = viewer.current; const fin = ev.detail && ev.detail.fin; const byId = window.__ssById;
      if (!vw || !vw.model || !fin || !byId) return;
      try {
        vw.clearThemingColors(vw.model);
        const T = window.THREE; const byHex = {};
        for (const i in fin) { const hx = fin[i] === 'm' ? fadeColor(byId[i] ? modelColor(vw, byId[i]) : null, ev.detail.fade) : fin[i]; (byHex[hx] = byHex[hx] || []).push(byId[i]); } // 'm' = no Revit colour: take the model's own, faded
        for (const hex in byHex) { const n = parseInt(hex, 16); const col = new T.Vector4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1); byHex[hex].filter(Boolean).forEach((d) => vw.setThemingColor(d, col, vw.model, true)); }
        vw.impl.invalidate(true, true, true);
      } catch (e) {}
    };
    window.addEventListener('ss-paint', f);
    return () => window.removeEventListener('ss-paint', f);
  }, []);

  // the colours follow the ticks: every few seconds the website's colours are asked for again, and the model is repainted when something changed
  useEffect(() => {
    let last = null;
    const tm = setInterval(async () => {
      if (document.hidden) return;
      const vw = viewer.current;
      if (!vw || !vw.model) return;
      try {
        const lay = modeRef.current === 'user';
        const s = await fetch('/api/colorrules?job=' + encodeURIComponent(job) + '&compute=1' + (lay ? '&layer=1' : ''), { cache: 'no-store' }).then((r) => r.text());
        if (last !== null && s !== last) applyLook(vw, job, lay ? layerRef.current : null, true);
        last = s;
      } catch (e) {}
    }, 8000);
    return () => clearInterval(tm);
  }, [job]);

  useEffect(() => {
    const f = () => { const vw = viewer.current; if (vw && vw.model) { resetLook(vw); applyLook(vw, job, modeRef.current === 'user' ? layerRef.current : null, 'iso'); } };
    window.addEventListener('ss-reload-look', f);
    return () => window.removeEventListener('ss-reload-look', f);
  }, [job]);

  // saved camera views: read where the camera stands / move it there (also switches to the Revit view the angle was made in)
  const getCam = () => {
    const vw = viewer.current;
    if (!vw || !vw.model) return null;
    try { const n = vw.navigation, p = n.getPosition(), t = n.getTarget(), u = n.getCameraUpVector(); return { pos: [p.x, p.y, p.z], target: [t.x, t.y, t.z], up: [u.x, u.y, u.z], persp: !!(vw.navigation.getCamera && vw.navigation.getCamera().isPerspective !== false) }; } catch (e) { return null; }
  };
  const goCam = async (cv) => {
    const vw = viewer.current;
    if (!vw || !vw.model || !cv || !cv.cam) return;
    if (cv.view && cv.view !== (window.__ssView || '')) { try { await switchView(cv.view); await new Promise((r) => setTimeout(r, 700)); } catch (e) {} }
    try {
      const T = window.THREE, c = cv.cam, n = vw.navigation;
      c.persp ? n.toPerspective() : n.toOrthographic();
      n.setView(new T.Vector3(...c.pos), new T.Vector3(...c.target));
      n.setCameraUpVector(new T.Vector3(...c.up));
      vw.impl.invalidate(true, true, true);
    } catch (e) {}
  };

  // go to an element by its Revit number: the camera flies to it and an orange dashed frame marks it
  const [frame, setFrame] = useState(null);
  const frameFor = useRef(null);
  const elemRect = (vw, d) => {
    try {
      const T = window.THREE, tree = vw.model.getInstanceTree(), fl = vw.model.getFragmentList();
      const bb = new T.Box3(), tmp = new T.Box3();
      tree.enumNodeFragments(d, (f) => { fl.getWorldBounds(f, tmp); bb.union(tmp); }, true);
      const xs = [], ys = [];
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { const p = vw.worldToClient(new T.Vector3(x, y, z)); xs.push(p.x); ys.push(p.y); }
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      if (![x0, x1, y0, y1].every(Number.isFinite)) return null;
      return { x: x0 - 6, y: y0 - 6, w: x1 - x0 + 12, h: y1 - y0 + 12 };
    } catch (e) { return null; }
  };
  const goElement = (n) => {
    const vw = viewer.current;
    const id = String(n == null ? '' : n).trim();
    if (!id) return { ok: false, msg: 'Type an element number.' };
    if (!vw || !vw.model) return { ok: false, msg: 'The model is not ready yet.' };
    const d = window.__ssById && window.__ssById[parseInt(id, 10)];
    if (!d) return { ok: false, msg: 'Element ' + id + ' is not in this model.' };
    let vis = true; try { vis = vw.impl.visibilityManager.isNodeVisible(d); } catch (e) { /* assume shown */ }
    if (!vis) return { ok: false, msg: 'Element ' + id + ' is not shown in this view.' };
    frameFor.current = d;
    try { vw.fitToView([d], vw.model, false); } catch (e) {}
    setTimeout(() => { if (frameFor.current === d) setFrame(elemRect(vw, d)); }, 900);
    return { ok: true };
  };
  if (typeof window !== 'undefined') window.__ssGoElement = goElement;
  useEffect(() => { const f = (e) => setMsg(String(e.detail || '')); window.addEventListener('ss-elem-msg', f); return () => window.removeEventListener('ss-elem-msg', f); }, []);
  useEffect(() => {
    if (!frame) return;
    const t = setInterval(() => { const vw = viewer.current; if (vw && vw.model && frameFor.current) setFrame(elemRect(vw, frameFor.current)); }, 150);
    const el = box.current;
    const clear = () => { frameFor.current = null; setFrame(null); };
    if (el) el.addEventListener('pointerdown', clear);
    return () => { clearInterval(t); if (el) el.removeEventListener('pointerdown', clear); };
  }, [!!frame]);
  // Copy popup: next to the part that was clicked, one press copies its number to the clipboard (to paste in a comment or anywhere)
  const [cp, setCp] = useState(null);
  const [copied, setCopied] = useState(false);
  const [kPick, setKPick] = useState(null);
  useEffect(() => {
    if (!kiosk) return;
    const f = (e) => setKPick(String(e.detail));
    window.addEventListener('ss-kiosk-pick', f);
    return () => window.removeEventListener('ss-kiosk-pick', f);
  }, [!!kiosk]);
  const popId = kiosk ? kPick : popup && popup.id;
  useEffect(() => {
    setCopied(false);
    if (!popId) { setCp(null); return; }
    const place = () => {
      const vw = viewer.current, b = box.current;
      const d = window.__ssById && window.__ssById[parseInt(popId, 10)];
      const r = vw && vw.model && b && d ? elemRect(vw, d) : null;
      if (!r) { setCp((o) => (o ? null : o)); return; }
      const W = b.clientWidth, H = b.clientHeight;
      const x = Math.round(Math.min(Math.max(r.x + r.w + 4, 4), W - 150)), y = Math.round(Math.min(Math.max(r.y, 4), H - 34));
      setCp((o) => (o && o.x === x && o.y === y ? o : { x, y }));
    };
    place();
    const t = setInterval(place, 200);
    return () => clearInterval(t);
  }, [popId]);
  const copyId = async () => {
    const t = String(popId || '');
    try { await navigator.clipboard.writeText(t); } catch (e) {
      try { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); document.execCommand('copy'); document.body.removeChild(a); } catch (x) {}
    }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };
  const [kmode, setKmode] = useState('issue');
  const [qlv, setQlv] = useState(() => { try { return Math.min(10, Math.max(1, Number(localStorage.getItem('ss-q')) || 6)); } catch (e) { return 6; } });
  // scanned view: the image-quality slider (1 = fastest, 10 = sharpest): the canvas resolution, plus smooth edges and shadows at the top
  useEffect(() => {
    if (!kiosk) return;
    try { localStorage.setItem('ss-q', String(qlv)); } catch (e) {}
    const apply = () => {
      const vw = viewer.current;
      if (!vw || !vw.model) return false;
      try {
        const top = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
        vw.impl.glrenderer().setPixelRatio(0.5 + (qlv - 1) * ((top - 0.5) / 9));
        vw.setQualityLevel(qlv >= 8, qlv >= 4);
        vw.resize();
        vw.impl.invalidate(true, true, true);
      } catch (e) {}
      return true;
    };
    if (apply()) return;
    const t = setInterval(() => { if (apply()) clearInterval(t); }, 700);
    return () => clearInterval(t);
  }, [qlv, kiosk && kiosk.viewId]);
  // scanned QR of a saved camera view: go to its angle once the model is there
  useEffect(() => {
    if (!kiosk) return;
    let v = null, tries = 0;
    fetch('/api/camviews?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { v = (j.views || []).find((x) => x.id === kiosk.viewId) || null; }).catch(() => {});
    const t = setInterval(() => {
      const vw = viewer.current;
      if (!v || !vw || !vw.model) return;
      tries++; goCam(v);
      if (tries >= 4) clearInterval(t);
    }, 1400);
    return () => clearInterval(t);
  }, [kiosk && kiosk.viewId, job]);

  // pick another Revit 3D view of this job. The model on the site is the whole building; a view is recreated from what it shows and its colours.
  async function switchView(name) {
    setVOpen(false); setVq('');
    const vw = viewer.current;
    if (!vw || !vw.model) return;
    window.__ssView = name; setCurView(name); try { localStorage.setItem('ss-view:' + job, name); } catch (e) {}
    resetLook(vw);
    await applyLook(vw, job, modeRef.current === 'user' ? layerRef.current : null);
  }

  async function toggle(tb, col, value) {
    // a tick belongs to the person's own layer, so show that layer (otherwise the saved tick and its colour are hidden behind the Source view)
    if (modeRef.current !== 'user') { setMode('user'); setOpenSrc(false); setOpenMe(true); }
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
  if (typeof window !== 'undefined') { window.__ssKiosk = !!kiosk; window.__ssNormal = !!kiosk && kmode === 'normal'; }
  const copyBtn = cp && popId ? (
          <button type="button" onClick={copyId} aria-label={'Copy element number ' + popId} style={{ position: 'absolute', left: cp.x, top: cp.y, zIndex: 11, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px', border: 0, borderRadius: 15, background: copied ? '#2e9e5b' : 'rgba(20,20,19,.86)', color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,.3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {copied ? '\u2713 Copied' : <><span style={{ fontSize: 14 }}>{'\u29C9'}</span>Copy {popId}</>}
          </button>
  ) : null;
  if (kiosk) {
    const closeCam = () => { let to = ''; try { to = sessionStorage.getItem('scan-from') || ''; } catch (e) {} location.replace(to || '/'); };
    // two looks of the scanned view: Issue view = the website's colours (filtered parts solid, the rest faded); Normal view = the model's own colours
    const pickK = async (k) => {
      if (k === kmode) return;
      setKmode(k); window.__ssNormal = k === 'normal';
      const vw = viewer.current;
      if (!vw || !vw.model) return;
      resetLook(vw);
      await applyLook(vw, job, modeRef.current === 'user' ? layerRef.current : null, 'iso');
    };
    const band = 'max(env(safe-area-inset-top, 0px), 44px)';
    const foot = 'calc(env(safe-area-inset-bottom, 0px) + 56px)';
    const tabK = (k, label) => (
      <button type="button" onClick={() => pickK(k)} aria-pressed={kmode === k} style={{ border: 0, borderRadius: 17, padding: '7px 15px', font: 'inherit', fontSize: 13, fontWeight: kmode === k ? 600 : 500, cursor: 'pointer', background: kmode === k ? 'rgba(20,20,19,.82)' : 'transparent', color: kmode === k ? '#fff' : '#141413' }}>{label}</button>
    );
    const lab = { fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em', color: 'rgba(20,20,19,.7)', textTransform: 'uppercase' };
    return (
      <section style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 100000, background: '#fff' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: band, background: '#fff', borderBottom: '1px solid #efece3' }} />
        <div ref={box} className="v3-box" style={{ position: 'absolute', left: 0, right: 0, top: band, bottom: foot, touchAction: 'none' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: band, bottom: foot, pointerEvents: 'none', zIndex: 6 }}><div style={{ position: 'relative', width: '100%', height: '100%' }}>{copyBtn}</div></div>
        {!ready && <div style={{ position: 'absolute', left: 0, right: 0, top: '45%', textAlign: 'center', color: '#8a8576', fontSize: 15 }}>Loading the model…</div>}
        <button type="button" onClick={closeCam} aria-label="Close" style={{ position: 'absolute', right: 14, top: 'calc(env(safe-area-inset-top, 0px) + 60px)', width: 46, height: 46, borderRadius: 23, border: 0, background: 'rgba(20,20,19,.78)', color: '#fff', fontSize: 22, cursor: 'pointer', zIndex: 5 }}>{'\u2715'}</button>
        <div style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 5 }}>
          <span style={lab}>Max</span>
          <div style={{ position: 'relative', width: 34, height: 160 }}>
            <input type="range" min="1" max="10" step="1" value={qlv} onChange={(e) => setQlv(Number(e.target.value))} aria-label="Image quality" style={{ position: 'absolute', left: '50%', top: '50%', width: 160, transform: 'translate(-50%,-50%) rotate(-90deg)', opacity: 0.75, margin: 0, touchAction: 'none' }} />
          </div>
          <span style={lab}>Min</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: foot, paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxSizing: 'border-box', background: '#fff', borderTop: '1px solid #efece3', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
          <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 20, background: '#f6f4ec', border: '1px solid rgba(20,20,19,.1)' }}>
            {tabK('issue', 'Issue view')}{tabK('normal', 'Normal view')}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="v3-wrap" style={wrap}>
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
      {ready && <CamViews job={job} getCam={getCam} goCam={goCam} goEl={goElement} />}
      <div style={{ position: 'relative' }}>
        <div ref={box} className="v3-box" style={{ position: 'relative', height: ready ? 480 : 0, touchAction: 'none' }} />
        {copyBtn}
        {frame && <div style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.w, height: frame.h, border: '2.5px dashed #e8710a', borderRadius: 6, pointerEvents: 'none', zIndex: 9 }} />}
        {ready && (
          <div
            style={{ position: 'absolute', right: 0, top: 230, height: 170, width: 44, touchAction: 'pan-y', zIndex: 10, background: 'rgba(22,38,46,.18)', borderLeft: '1px solid rgba(22,38,46,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16262e', fontSize: 18, lineHeight: 1.1, textAlign: 'center', userSelect: 'none' }}
          >
            {'\u25B2'}<br />{'\u2195'}<br />{'\u25BC'}
          </div>
        )}
        <Snapshots job={job} />
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
            <div className="v3-sheet" style={{ background: '#fff', borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 24px rgba(20,20,19,.12)', padding: '6px 0 12px', maxHeight: 380, overflow: 'auto', maxWidth: 520, margin: '0 auto', fontSize: 13, color: '#141413' }}>
              <div style={{ width: 38, height: 4, borderRadius: 4, background: '#d9d5c8', margin: '4px auto 8px' }} />
              <div style={{ padding: '2px 16px 10px', fontWeight: 700, fontSize: 14 }}>{pp.id ? <>{'Element '}{linkNums(pp.id, 'ttl', true)}</> : 'No element selected'}</div>
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
                  {ed ? <input type="checkbox" aria-label={c.name} checked={(tb.id + '|' + tb.element_id + '|' + c.name) in draft ? !!draft[tb.id + '|' + tb.element_id + '|' + c.name].value : !!(tb.vals && tb.vals[c.name] === true)} onChange={(e) => toggle(tb, c.name, e.target.checked)} style={{ width: 22, height: 22, accentColor: '#2e9e5b' }} /> : <span style={{ color: '#9a9686', textAlign: 'right' }}>{val(tb, c)}</span>}
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
