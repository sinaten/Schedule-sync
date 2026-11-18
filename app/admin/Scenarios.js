'use client';
import { useEffect, useRef, useState } from 'react';
import ScenarioMap from '../ScenarioMap';
import { PIN_TYPES } from '../GuideMap';
import AiText from './AiText';

// Admin > Projects > a site > Scenarios. Each scenario is a picture (aerial or uploaded) with pins, arrows, routes and labels, a description and its own link.
const uid = () => Math.random().toString(36).slice(2, 10);
const EMPTY = { name: '', base: 'aerial', image: null, pins: [], marks: [], view: null, desc: '' };
const TOOLS = [['move', 'Move / edit'], ['pin', 'Pin'], ['arrow', 'Arrow'], ['route', 'Route'], ['text', 'Text']];

function shrink(file, max = 2200) { // phone pictures are big: scale down so the upload fits
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), w = Math.round(im.width * k), h = Math.round(im.height * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
      c.toBlob((b) => { URL.revokeObjectURL(u); b ? res({ blob: b, w, h }) : rej(new Error('Could not read the picture')); }, 'image/jpeg', 0.85);
    };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Could not read the picture')); };
    im.src = u;
  });
}

export default function Scenarios({ site, siteName, center, sitePins }) {
  const [list, setList] = useState(null);
  const [ed, setEd] = useState(null);      // the scenario being edited
  const [token, setToken] = useState('');
  const [dirty, setDirty] = useState(false);
  const [tool, setTool] = useState('pin');
  const [pinType, setPinType] = useState('Entrance');
  const [pinName, setPinName] = useState('');
  const [textVal, setTextVal] = useState('');
  const [pending, setPending] = useState(0);
  const [msg, setMsg] = useState('');
  const api = useRef(null);

  const load = () => fetch('/api/admin/scenarios?site=' + encodeURIComponent(site), { cache: 'no-store' }).then((r) => r.json()).then((d) => setList(d.scenarios || [])).catch(() => setList([]));
  useEffect(() => { setEd(null); setList(null); load(); }, [site]);
  const link = (t) => location.origin + '/scenario/' + t;
  const copy = async (t) => { const l = link(t); try { await navigator.clipboard.writeText(l); setMsg('Link copied: ' + l); } catch { setMsg('Link: ' + l); } };

  const up = (patch) => { setEd((x) => ({ ...x, ...patch })); setDirty(true); };
  const upf = (fn) => { setEd((x) => ({ ...x, ...fn(x) })); setDirty(true); }; // always from the latest state, so quick clicks never lose earlier drawings
  const open = async (t) => {
    setMsg('');
    if (!t) { setEd({ ...EMPTY }); setToken(''); setDirty(false); setTool('pin'); return; }
    const r = await fetch('/api/admin/scenarios?token=' + t, { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok) { setMsg(d.error || 'Could not open'); return; }
    setEd({ ...EMPTY, ...d.scenario }); setToken(t); setDirty(false); setTool('move');
  };
  const back = () => { if (dirty && !confirm('You have changes that are not saved. Leave without saving?')) return; setEd(null); load(); };
  const save = async () => {
    setMsg('Saving…');
    const r = await fetch('/api/admin/scenarios', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ site, token, scenario: ed }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(d.error || 'Could not save'); return; }
    setToken(d.token); setDirty(false); setMsg('Saved'); load();
  };
  const del = async (t, name) => {
    if (!confirm('Delete the scenario "' + name + '"? Its link stops working. This cannot be undone.')) return;
    await fetch('/api/admin/scenarios?token=' + t, { method: 'DELETE' }); setMsg('Deleted'); load();
  };
  const setImage = async (file) => {
    if (!file) return;
    setMsg('Uploading the picture…');
    try {
      const { blob, w, h } = await shrink(file);
      const f = new FormData(); f.append('file', new File([blob], 'scenario.jpg', { type: 'image/jpeg' })); f.append('site', site);
      const r = await fetch('/api/admin/siteupload', { method: 'POST', body: f });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Upload failed');
      up({ base: 'image', image: { path: d.path, w, h }, pins: [], marks: [], view: null }); setMsg('Picture added. Pins and arrows start empty on it.');
    } catch (e) { setMsg(e.message); }
  };
  const imgObj = ed && ed.base === 'image' && ed.image ? { url: '/api/admin/sitefile?p=' + encodeURIComponent(ed.image.path), w: ed.image.w, h: ed.image.h } : null;
  const btn = (on) => ({ padding: '7px 12px', fontSize: 15, border: '1px solid ' + (on ? 'var(--acc)' : 'var(--line)'), background: on ? '#e3f1f2' : '#fff', borderRadius: 6, cursor: 'pointer' });

  if (!ed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="muted" style={{ fontSize: 13 }}>Draw a way on the picture with pins and arrows, give it a name and send its link. Anyone with the link can open it, no login.</div>
        {list === null && <div className="muted">Loading…</div>}
        {list && !list.length && <div className="muted">No scenarios yet.</div>}
        {(list || []).map((s) => (
          <div key={s.token} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: '#fff' }}>
            <b style={{ flex: '1 1 160px', minWidth: 0 }}>{s.name}</b>
            <button type="button" className="ph-btn" style={{ padding: '6px 10px' }} onClick={() => open(s.token)}>Edit</button>
            <button type="button" className="ph-btn" style={{ padding: '6px 10px' }} onClick={() => copy(s.token)}>Copy link</button>
            <a className="ph-btn" style={{ padding: '6px 10px' }} href={link(s.token)} target="_blank" rel="noreferrer">Open</a>
            <button type="button" className="ph-btn" style={{ padding: '6px 10px' }} onClick={() => del(s.token, s.name)}>Delete</button>
          </div>
        ))}
        <div><button type="button" className="ph-btn pri" onClick={() => open('')}>New scenario</button></div>
        {msg && <div style={{ fontSize: 14, wordBreak: 'break-all' }}><b>{msg}</b></div>}
      </div>
    );
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#fff', overflow: 'auto', padding: 14 }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="ph-btn" onClick={back}>&larr; Scenarios</button>
          <input className="ph-in" aria-label="Scenario name" placeholder="Scenario name, e.g. Delivery truck route" value={ed.name} onChange={(e) => up({ name: e.target.value })} style={{ flex: '1 1 220px', fontWeight: 600 }} />
          <button type="button" className="ph-btn pri" onClick={save} disabled={!dirty && !!token}>Save</button>
          {token && <button type="button" className="ph-btn" onClick={() => copy(token)}>Copy link</button>}
        </div>
        {msg && <div style={{ fontSize: 14, wordBreak: 'break-all' }}><b>{msg}</b></div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 14 }}>Picture:</span>
          <button type="button" style={btn(ed.base === 'aerial')} onClick={() => { if (ed.base !== 'aerial') up({ base: 'aerial', view: null, pins: [], marks: [] }); }}>Aerial view of {siteName || 'the site'}</button>
          <label style={{ ...btn(ed.base === 'image'), display: 'inline-block' }}>Upload a picture<input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { setImage(e.target.files && e.target.files[0]); e.target.value = ''; }} /></label>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TOOLS.map(([k, n]) => <button key={k} type="button" style={btn(tool === k)} onClick={() => setTool(k)}>{n}</button>)}
          {tool === 'route' && <button type="button" style={btn(false)} disabled={pending < 2} onClick={() => api.current && api.current.finishRoute()}>Finish route ({pending} points)</button>}
          {(tool === 'route' || tool === 'arrow') && pending > 0 && <button type="button" style={btn(false)} onClick={() => api.current && api.current.cancelPending()}>Cancel</button>}
        </div>
        {tool === 'pin' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.keys(PIN_TYPES).map((k) => <button key={k} type="button" style={btn(pinType === k)} onClick={() => setPinType(k)}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: PIN_TYPES[k], marginRight: 6 }} />{k}</button>)}
            <input className="ph-in" aria-label="Name for the next pin" placeholder="Name for the next pin (optional)" value={pinName} onChange={(e) => setPinName(e.target.value)} style={{ flex: '1 1 200px', width: 'auto' }} />
          </div>
        )}
        {tool === 'text' && <input className="ph-in" aria-label="Text for the next label" placeholder="Type the label, then click the map, e.g. Turn left here" value={textVal} onChange={(e) => setTextVal(e.target.value)} />}
        <div className="muted" style={{ fontSize: 13 }}>
          {tool === 'move' ? 'Drag pins and labels to move them. Click a pin, arrow or label to rename or delete it.' : tool === 'pin' ? 'Click the map to place a pin.' : tool === 'arrow' ? 'Click the start, then click the end.' : tool === 'route' ? 'Click each corner of the way, then press Finish route.' : 'Click the map to place the label.'}
        </div>
        <ScenarioMap key={ed.base + (ed.image ? ed.image.path : '')} base={ed.base} image={imgObj} center={center} view={ed.view} editable tool={tool} pinType={pinType} pinName={pinName} textVal={textVal} apiRef={api}
          pins={ed.pins} marks={ed.marks} height={460} onPending={setPending}
          onAddPin={(la, lo) => upf((x) => ({ pins: [...x.pins, { type: pinType, where: pinName.trim(), lat: la, lng: lo }] }))}
          onMovePin={(i, la, lo) => upf((x) => ({ pins: x.pins.map((p, j) => (j === i ? { ...p, lat: la, lng: lo } : p)) }))}
          onRenamePin={(i, t) => upf((x) => ({ pins: x.pins.map((p, j) => (j === i ? { ...p, where: t } : p)) }))}
          onRemovePin={(i) => upf((x) => ({ pins: x.pins.filter((_, j) => j !== i) }))}
          onAddMark={(m) => upf((x) => ({ marks: [...x.marks, m] }))}
          onMoveMark={(id, pt) => upf((x) => ({ marks: x.marks.map((m) => (m.id === id ? { ...m, pts: [pt] } : m)) }))}
          onEditMark={(id, t) => upf((x) => ({ marks: x.marks.map((m) => (m.id === id ? { ...m, text: t } : m)) }))}
          onRemoveMark={(id) => upf((x) => ({ marks: x.marks.filter((m) => m.id !== id) }))}
          onView={(v) => { if (ed.view === null || Math.abs((ed.view.lat || 0) - v.lat) > 1e-9 || ed.view.zoom !== v.zoom) setEd((x) => ({ ...x, view: v })); }} />
        {ed.base === 'aerial' && sitePins && sitePins.some((p) => p.lat != null) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 14 }}>Add a pin from the site guide:</span>
            {sitePins.filter((p) => p.lat != null).map((p, i) => <button key={i} type="button" style={btn(false)} onClick={() => upf((x) => ({ pins: [...x.pins, { type: p.type, where: p.where || '', lat: p.lat, lng: p.lng }] }))}>+ {p.type}{p.where ? ': ' + p.where : ''}</button>)}
          </div>
        )}
        <label><span className="ph-lab">Description (the steps, shown under the map)</span>
          <AiText rows={4} placeholder="First go to the office, then turn left at the gate, then park at the east lot. Use (AI. like this) for notes only the AI reads." value={ed.desc} onChange={(t) => up({ desc: t })} />
        </label>
      </div>
    </div>
  );
}
