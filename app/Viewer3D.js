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
        const [h, tr] = hex.split('_');
        const n = parseInt(h, 16);
        const col = new T.Vector4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1);
        const ids = dbIds(look.colors[hex]);
        ids.forEach((d) => vw.setThemingColor(d, col, vw.model, true));
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
  const [draft, setDraft] = useState({});
  const [openSrc, setOpenSrc] = useState(false);
  const [openMe, setOpenMe] = useState(true);
  const [mode, setMode] = useState('user');
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
    const f = () => { const vw = viewer.current; if (vw && vw.model) { resetLook(vw); applyLook(vw, job); } };
    window.addEventListener('ss-reload-look', f);
    return () => window.removeEventListener('ss-reload-look', f);
  }, [job]);

  async function toggle(tb, col, value) {
    setPopup((p) => p && { ...p, tables: p.tables.map((t) => (t.id === tb.id ? { ...t, vals: { ...t.vals, [col]: value } } : t)) });
    setDraft((d) => ({ ...d, [tb.id + '|' + tb.element_id + '|' + col]: { id: tb.id, eid: tb.element_id, col, value } }));
  }

  async function saveDraft() {
    const items = Object.values(draft);
    let bad = '';
    for (const it of items) {
      try {
        const r = await fetch('/api/schedules/' + encodeURIComponent(it.id) + '/edits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ elementId: it.eid, col: it.col, value: it.value }) });
        if (!r.ok) bad = it.col;
      } catch (e) { bad = it.col; }
    }
    setDraft({});
    setMsg(bad ? 'You cannot change ' + bad : 'Saved. Revit gets the change on its next sync.');
  }

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
        <div ref={box} style={{ position: 'relative', height: ready ? 480 : 0, touchAction: 'none' }} />
        {ready && (
          <div
            style={{ position: 'absolute', right: 0, top: 230, height: 170, width: 44, touchAction: 'pan-y', zIndex: 10, background: 'rgba(22,38,46,.18)', borderLeft: '1px solid rgba(22,38,46,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16262e', fontSize: 18, lineHeight: 1.1, textAlign: 'center', userSelect: 'none' }}
          >
            {'\u25B2'}<br />{'\u2195'}<br />{'\u25BC'}
          </div>
        )}
        {(() => {
          const pp = popup || { id: null, tables: [] };
          if (pp.tables[0] && pp.tables[0].me) meRef.current = pp.tables[0].me;
          const me = meRef.current || 'Me';
          const locked = [];
          const mine = [];
          // the user's bar shows the parameters of the Revit group "Other" (older uploads without group info fall back to the ticks the user may change)
          const hasGroup = pp.tables.some((tb) => tb.columns.some((c) => c.group));
          pp.tables.forEach((tb) => tb.columns.forEach((c) => { const ed = (tb.editable || []).includes(c.name); if ((hasGroup ? /^other/i.test(c.group || '') : ed) && !/link|url/i.test(c.name)) mine.push({ tb, c, ed }); }));
          const val = (tb, c) => { const v = tb.vals && tb.vals[c.name]; return typeof v === 'boolean' ? (v ? '✓ Yes' : 'No') : show(v); };
          const SHOW_LINKS = false; // flip to true to show URL / link columns in Source
          const isLink = (tb, c) => !SHOW_LINKS && (/link|url/i.test(c.name) || /^https?:\/\//.test(String((tb.vals && tb.vals[c.name]) || '')));
          const pick = (m) => { setMode(m); setOpenSrc(m === 'source'); setOpenMe(m === 'user'); };
          const bar = (icon, title, open, setOpen, body) => (
            <div style={{ margin: '0 12px 8px', border: '1px solid #efece3', borderRadius: 14, overflow: 'hidden', background: '#fdfcf9' }}>
              <button type="button" onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: 0, background: 'none', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left', color: '#141413' }}>
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
