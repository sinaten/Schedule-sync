'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import MapPicker from './MapPicker';
import GuideMap, { PIN_TYPES } from '../GuideMap';
import Projects from './Projects';
import { WORKFLOWS } from '../../lib/projmeta';

// Admin > Projects. A site comes first: it has the address, the pin on the map and what all its projects share (contacts, places, workflows).
// The projects are created inside a site. Each project has its own settings on top of the site's.
const ES = { name: '', country: '', city: '', address: '', lat: null, lng: null, about: '', orientation: {}, guide: '', contacts: [], places: [], wf: {} };
const uid = () => Math.random().toString(36).slice(2, 10);
const EP = { siteId: '', contacts: [], places: [], wf: {} };
const ROLES = ['HSE officer', 'Project manager', 'Site manager', 'Security', 'Emergency', 'Facility manager'];
const PLACES = ['Parking', 'Restroom', 'First aid', 'Muster point', 'Entrance', 'Canteen', 'Fire extinguisher', 'Storage'];
const FIELDS = { contacts: [['role', 'Role', '1 1 120px'], ['name', 'Name', '1 1 120px'], ['phone', 'Phone', '1 1 120px'], ['email', 'Email', '1 1 160px']], places: [['type', 'Place', '1 1 140px'], ['where', 'Where it is', '2 1 200px']] };
const TABS = ['Contacts', 'Places', 'Workflow', 'Sections & QR'];
const SKIP = new Set(['EU', 'UN', 'EZ', 'XA', 'XB', 'QO', 'AC', 'CP', 'DG', 'EA', 'IC', 'TA', 'XK']);
const COUNTRIES = (() => {
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' }), out = [];
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const c = String.fromCharCode(a, b), n = dn.of(c); if (n && n !== c && !/unknown/i.test(n) && !SKIP.has(c)) out.push({ c, n: c === 'US' ? 'USA' : n }); }
    return out.sort((x, y) => x.n.localeCompare(y.n));
  } catch (e) { return []; }
})();
const codeOf = (name) => { const t = String(name || '').trim().toLowerCase(); const r = COUNTRIES.find((x) => x.n.toLowerCase() === t); return r ? r.c : ''; };
const nameOf = (code) => { const r = COUNTRIES.find((x) => x.c === String(code || '').toUpperCase()); return r ? r.n : ''; };
const fmt = (m) => (m.lat != null && m.lng != null ? Number(m.lat).toFixed(6) + ', ' + Number(m.lng).toFixed(6) : '');
const has = (a, b) => !b || String(a || '').toLowerCase().includes(String(b).trim().toLowerCase());

const CSS = `
.ph-in{padding:8px 10px;font-size:16px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink);min-width:0;width:100%}
.ph-btn{padding:8px 14px;font-size:15px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink);cursor:pointer;text-decoration:none;display:inline-block}
.ph-btn.pri{background:var(--ink);color:#fff;border-color:var(--ink)}
.ph-btn:disabled{opacity:.5;cursor:default}
.ph-card{border:1px solid var(--line);border-radius:8px;padding:9px 11px;cursor:pointer;background:#fff}
.ph-card:hover{background:#f3f6f7}
.ph-card.sel{background:#e3f1f2;border-color:var(--acc)}
.ph-tag{font-size:12px;padding:1px 9px;border-radius:99px;background:#eef2f3;color:var(--mut);white-space:nowrap}
.ph-tag.s{background:#e3f1f2;color:#0a5a62}
.ph-tabs{display:flex;gap:6px;overflow-x:auto;border-bottom:1px solid var(--line);padding-bottom:8px}
.ph-tabs button{padding:6px 14px;font-size:14px;font-weight:600;border-radius:20px;border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer;white-space:nowrap}
.ph-tabs button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.ph-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-radius:8px;padding:8px;background:#fff}
.ph-sw{width:40px;height:22px;border-radius:11px;background:#b8c4c9;position:relative;border:0;padding:0;cursor:pointer;flex:none}
.ph-sw:after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s}
.ph-sw.on{background:var(--acc)}
.ph-sw.on:after{left:20px}
.ph-lab{font-size:13px;color:var(--mut);display:block;margin:0 0 3px}
.ph-sec{border:1px solid var(--line);border-radius:10px;background:#fff;display:flex;flex-direction:column}
.ph-h{display:flex;gap:8px;align-items:center;width:100%;padding:11px 12px;border:0;background:transparent;font:inherit;font-weight:600;font-size:16px;color:var(--ink);cursor:pointer;text-align:left}
.ph-h.sub{font-size:15px;font-weight:500;border-top:1px solid var(--line)}
.ph-ch{width:8px;height:8px;border-right:2px solid var(--mut);border-bottom:2px solid var(--mut);transform:rotate(-45deg);margin-left:auto;transition:transform .15s;flex:none}
.ph-ch.o{transform:rotate(45deg)}
.ph-body{padding:0 12px 12px;display:flex;flex-direction:column;gap:10px}
.ph-note{background:#e3f1f2;color:#0a5a62;border-radius:8px;padding:8px 10px;font-size:14px}
.ph-bc{font-size:13px;color:var(--mut);display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ph-bc a{cursor:pointer;color:var(--acc)}
`;

export default function ProjectHub() {
  const [jobs, setJobs] = useState(null);
  const [meta, setMeta] = useState({});
  const [sites, setSites] = useState({});
  const [fc, setFc] = useState('');
  const [fcity, setFcity] = useState('');
  const [q, setQ] = useState('');
  const [selSite, setSelSite] = useState('');
  const [selProj, setSelProj] = useState('');
  const [tab, setTab] = useState('Contacts');
  const [scope, setScope] = useState('project');
  const [op, setOp] = useState({ loc: true, book: true, projs: true });
  const [msg, setMsg] = useState('');
  const [wide, setWide] = useState(true);
  const [ds, setDs] = useState(ES);
  const [dp, setDp] = useState(EP);
  const [dirtyS, setDirtyS] = useState(false);
  const [dirtyP, setDirtyP] = useState(false);
  const [ct, setCt] = useState(null);
  const [map, setMap] = useState('');
  const [gType, setGType] = useState('Entrance');
  const [addSite, setAddSite] = useState(false);
  const [newSite, setNewSite] = useState('');
  const [addProj, setAddProj] = useState(false);
  const [newProj, setNewProj] = useState('');
  const [cityQ, setCityQ] = useState('');
  const [hits, setHits] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fn = () => setWide(window.innerWidth >= 760);
    fn(); window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch('/api/admin/jobs', { cache: 'no-store' }), fetch('/api/admin/projmeta', { cache: 'no-store' })]);
    if (!a.ok || !b.ok) { setMsg('Could not load projects (' + (a.ok ? b.status : a.status) + ')'); setJobs((x) => x || []); return null; }
    const ja = await a.json(), jb = await b.json();
    const base = ja.jobs || [], have = new Set(base.map((x) => x.job));
    const extra = Object.keys(jb.meta || {}).filter((k) => !have.has(k)).map((k) => ({ job: k, state: 'active', title: '' }));
    const all = [...base, ...extra].sort((x, y) => x.job.localeCompare(y.job, undefined, { numeric: true }));
    setJobs(all); setMeta(jb.meta || {}); setSites(jb.sites || {});
    return { jobs: all, meta: jb.meta || {}, sites: jb.sites || {} };
  }, []);
  useEffect(() => { load(); }, [load]);

  // Online city suggestions for the site's city box
  useEffect(() => {
    const t = cityQ.trim();
    if (t.length < 2) { setHits([]); return; }
    let dead = false;
    const id = setTimeout(async () => {
      try {
        const cc = codeOf(ds.country);
        const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(t) + '&count=8&language=en&format=json' + (cc ? '&countryCode=' + cc : ''));
        const j = await r.json();
        if (!dead) setHits((j.results || []).map((x) => ({ v: x.name + (x.admin1 ? ', ' + x.admin1 : ''), country: nameOf(x.country_code) || x.country || '' })));
      } catch (e) { if (!dead) setHits([]); }
    }, 300);
    return () => { dead = true; clearTimeout(id); };
  }, [cityQ, ds.country]);

  const dirty = dirtyS || dirtyP;
  const upS = (patch) => { setDs((x) => ({ ...x, ...patch })); setDirtyS(true); };
  const upP = (patch) => { setDp((x) => ({ ...x, ...patch })); setDirtyP(true); };
  const clean = () => !dirty || confirm('Discard the unsaved changes?');
  const reset = () => { setDirtyS(false); setDirtyP(false); setCt(null); setAddProj(false); setNewProj(''); setMsg(''); };

  const siteArr = Object.values(sites).sort((a, b) => a.name.localeCompare(b.name));
  const projOf = (id) => (jobs || []).filter((x) => meta[x.job] && meta[x.job].siteId === id);
  const orphans = (jobs || []).filter((x) => !(meta[x.job] && sites[meta[x.job].siteId]));

  // Navigation
  const openSite = (id, s0, m0) => { const S = s0 || sites; if (!(id === selSite && !selProj) && !clean()) return; reset(); setSelSite(id); setSelProj(''); setDp(EP); setDs(id && id !== '~' && S[id] ? { ...ES, ...S[id] } : ES); };
  const openProj = (job, m0) => { if (job !== selProj && dirtyP && !confirm('Discard the unsaved changes of this project?')) return; setSelProj(job); setDp({ ...EP, ...((m0 || meta)[job] || {}) }); setDirtyP(false); setTab('Contacts'); setScope('project'); setMsg(''); };
  const toSite = () => { if (dirtyP && !confirm('Discard the unsaved changes of this project?')) return; setSelProj(''); setDp(EP); setDirtyP(false); setMsg(''); };
  const toList = () => { if (!clean()) return; reset(); setSelSite(''); setSelProj(''); setDs(ES); setDp(EP); };

  // Refresh keeps you where you are: ?s=site&p=project&pt=tab
  useEffect(() => {
    if (jobs === null || ready) return;
    try {
      const u = new URLSearchParams(location.search), s = u.get('s'), p = u.get('p'), t = u.get('pt');
      if (s === '~' || (s && sites[s])) { setSelSite(s); setDs(s !== '~' ? { ...ES, ...sites[s] } : ES); }
      if (s && p && jobs.some((x) => x.job === p)) { setSelProj(p); setDp({ ...EP, ...(meta[p] || {}) }); if (TABS.includes(t)) setTab(t); }
    } catch (e) {}
    setReady(true);
  }, [jobs, ready, meta, sites]);
  useEffect(() => {
    if (!ready) return;
    try {
      const u = new URL(location.href);
      ['s', 'p', 'pt'].forEach((k) => u.searchParams.delete(k));
      if (selSite) u.searchParams.set('s', selSite);
      if (selSite && selProj) { u.searchParams.set('p', selProj); u.searchParams.set('pt', tab); }
      history.replaceState(null, '', u.pathname + u.search);
    } catch (e) {}
  }, [selSite, selProj, tab, ready]);

  const put = async (body) => { const r = await fetch('/api/admin/projmeta', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Failed (' + r.status + ')'); return j; };

  async function createSite() {
    const name = newSite.trim();
    if (!name) return;
    if (Object.values(sites).some((x) => x.name.toLowerCase() === name.toLowerCase()) && !confirm('A site called ' + name + ' already exists. Create another one with the same name?')) return;
    setMsg('Creating…');
    try {
      const j = await put({ site: { ...ES, name, country: fc, city: fcity } });
      const d = await load();
      setNewSite(''); setAddSite(false); reset(); setSelSite(j.id); setSelProj(''); setDp(EP); setDs({ ...ES, ...((d && d.sites[j.id]) || {}) }); setOp({ loc: true, book: true, projs: true });
      setMsg('Site created. Pin it on the map or type the address.');
    } catch (e) { setMsg(e.message); }
  }
  async function createProject() {
    const name = newProj.trim();
    if (!name) return;
    if (name.includes('>') || name.length > 80) { setMsg('Use a shorter name without the > sign'); return; }
    if ((jobs || []).some((x) => x.job.toLowerCase() === name.toLowerCase())) { setMsg('A project with this name already exists'); return; }
    setMsg('Creating…');
    try {
      await put({ job: name, meta: { ...EP, siteId: selSite } });
      const d = await load();
      setNewProj(''); setAddProj(false); openProj(name, d && d.meta); setMsg('Project created.');
    } catch (e) { setMsg(e.message); }
  }
  async function save() {
    setMsg('Saving…');
    try {
      if (dirtyS && selSite && selSite !== '~') await put({ site: { ...ds, id: selSite } });
      if (dirtyP && selProj) await put({ job: selProj, meta: dp });
      const moved = dirtyP && selProj && dp.siteId && dp.siteId !== selSite;
      const d = await load();
      setDirtyS(false); setDirtyP(false);
      if (moved && d) { setSelSite(dp.siteId); setDs({ ...ES, ...(d.sites[dp.siteId] || {}) }); }
      setMsg('Saved');
    } catch (e) { setMsg(e.message); }
  }
  // Auto-save: when a change was made and the person clicks elsewhere or leaves the field, it is saved without pressing Save.
  const autoRef = useRef({ dirty: false, save: null, busy: false });
  autoRef.current.dirty = dirty; autoRef.current.save = save;
  useEffect(() => {
    const go = async () => {
      const a = autoRef.current;
      if (!a.dirty || a.busy) return;
      a.busy = true;
      try { await a.save(); } finally { a.busy = false; }
    };
    const onDown = (e) => { const t = e.target; if (t && t.closest && t.closest('.ph-in, input, textarea, select')) return; go(); };
    const onOut = (e) => { const t = e.target; if (t && t.closest && t.closest('.ph-in, input, textarea, select')) setTimeout(go, 0); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('focusout', onOut, true);
    return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('focusout', onOut, true); };
  }, []);
  async function assign(job, siteId) {
    if (!siteId) return;
    setMsg('Saving…');
    try { await put({ job, meta: { ...EP, ...(meta[job] || {}), siteId } }); await load(); setMsg('Moved into the site'); } catch (e) { setMsg(e.message); }
  }
  async function removeSite() {
    if (!confirm('Delete the site ' + ds.name + '? Its address, contacts and places are removed. This cannot be undone.')) return;
    const r = await fetch('/api/admin/projmeta?site=' + encodeURIComponent(selSite), { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Failed (' + r.status + ')'); return; }
    reset(); setSelSite(''); setDs(ES); await load(); setMsg('Site deleted');
  }

  // Pin / GPS: fill the empty address, city and country of the site from the coordinates (a 500 m circle around the pin, two sources)
  async function geo(lat, lng) {
    const get = async (u) => { try { const r = await fetch(u); return await r.json(); } catch (e) { return null; } };
    setMsg('Reading the address from the pin…');
    const [ph, bd] = await Promise.all([
      get('https://photon.komoot.io/reverse?lang=en&radius=0.5&limit=8&lat=' + lat + '&lon=' + lng),
      get('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en&latitude=' + lat + '&longitude=' + lng),
    ]);
    const fs = ((ph && ph.features) || []).map((x) => x.properties || {});
    const first = (k) => { const f = fs.find((x) => x[k]); return f ? f[k] : ''; };
    const town = first('city') || first('town') || first('village') || first('district') || (bd && (bd.city || bd.locality)) || first('county') || '';
    const state = first('state') || (bd && bd.principalSubdivision) || '';
    const code = first('countrycode') || (bd && bd.countryCode) || '';
    const country = nameOf(code) || first('country') || (bd && bd.countryName) || '';
    const sf = fs.find((x) => x.street);
    const street = sf ? [sf.housenumber, sf.street].filter(Boolean).join(' ') : (fs[0] && fs[0].name) || '';
    const zip = first('postcode') || (bd && bd.postcode) || '';
    const city = town ? town + (state ? ', ' + state : '') : '';
    const address = [street, town, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (!city && !country && !address) { setMsg('Pin saved, but no address was found near it. Type it in.'); return null; }
    return { country, city, address };
  }
  // Pin / GPS of the site: fill the empty address, city and country (a 500 m circle around the pin, two sources)
  async function fillFrom(lat, lng) {
    const g = await geo(lat, lng);
    if (!g) return;
    setDs((x) => ({ ...x, country: x.country || g.country, city: x.city || g.city, address: x.address || g.address }));
    setDirtyS(true); setMsg('Address, city and country filled from the pin (only the empty boxes). Check them and press Save.');
  }
  // Pin of the orientation place: fill its empty address
  async function fillOri(lat, lng) {
    const g = await geo(lat, lng);
    if (!g) return;
    setDs((x) => ({ ...x, orientation: { ...(x.orientation || {}), address: (x.orientation && x.orientation.address) || g.address } }));
    setDirtyS(true); setMsg('Address filled from the pin. Press Save.');
  }
  const here = () => {
    if (!navigator.geolocation) { setMsg('This device has no location'); return; }
    setMsg('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (p) => { upS({ lat: p.coords.latitude, lng: p.coords.longitude }); setCt(null); setMsg('Got your location (±' + Math.round(p.coords.accuracy) + ' m).'); fillFrom(p.coords.latitude, p.coords.longitude); },
      (e) => setMsg(e && e.code === 1 ? 'Location is blocked. Allow it for this site.' : 'Could not get the location. Try outside.'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };
  const parseCt = (t) => {
    const m = String(t).match(/-?\d+(?:\.\d+)?/g);
    if (!String(t).trim()) { upS({ lat: null, lng: null }); return; }
    if (m && m.length >= 2 && Math.abs(+m[0]) <= 90 && Math.abs(+m[1]) <= 180) upS({ lat: +m[0], lng: +m[1] }); else setMsg('Use two numbers: latitude, longitude');
  };

  const o = ds.orientation || {};
  const upO = (patch) => upS({ orientation: { ...o, ...patch } });
  const pickPerson = (field, v) => {
    if (v === '') { upO({ [field]: '' }); return; }
    const i = +v, c = ds.contacts[i];
    if (!c) return;
    if (c.id) { upO({ [field]: c.id }); return; }
    const id = uid();
    upS({ contacts: ds.contacts.map((x, j) => (j === i ? { ...x, id } : x)), orientation: { ...o, [field]: id } });
  };
  const idxOf = (id) => (id ? String(ds.contacts.findIndex((c) => c.id === id)).replace('-1', '') : '');
  async function addFile(file) {
    if (!file) return;
    setMsg('Uploading…');
    const fd = new FormData(); fd.append('site', selSite); fd.append('file', file);
    const r = await fetch('/api/admin/siteupload', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Upload failed (' + r.status + ')'); return; }
    upO({ files: [...(o.files || []), { name: j.name, path: j.path }] }); setMsg('File added. Press Save.');
  }
  async function guideLink(on) {
    if (on === false && !confirm('Turn the share link off? Anyone who has the old link will no longer see the guide.')) return;
    setMsg('…');
    const r = await fetch('/api/admin/projmeta', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guide: { site: selSite, on } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Failed (' + r.status + ')'); return; }
    setDs((x) => ({ ...x, guide: j.guide || '' })); setSites((x) => ({ ...x, [selSite]: { ...(x[selSite] || {}), guide: j.guide || '' } })); setMsg(on ? 'Share link created' : 'Share link turned off');
  }
  const gurl = ds.guide && typeof location !== 'undefined' ? location.origin + '/guide/' + ds.guide : '';
  const dl = (id, arr) => <datalist id={id}>{arr.map((x) => <option key={x} value={x} />)}</datalist>;
  const head = (k, title, count, sub) => (
    <button type="button" className={'ph-h' + (sub ? ' sub' : '')} aria-expanded={!!op[k]} onClick={() => setOp({ ...op, [k]: !op[k] })}>
      <span>{title}</span>{count !== undefined && <span className="ph-tag">{count}</span>}<span className={'ph-ch' + (op[k] ? ' o' : '')} />
    </button>
  );

  // ----- left: filters and the list of sites -----
  const cities = [...new Set(siteArr.filter((s) => has(s.country, fc)).map((s) => s.city).filter(Boolean))].sort();
  const shown = siteArr.filter((s) => {
    if (!has(s.country, fc) || !has(s.city, fcity)) return false;
    const t = q.trim().toLowerCase();
    return !t || (s.name + ' ' + s.city + ' ' + s.country + ' ' + projOf(s.id).map((x) => x.job + ' ' + (x.title || '')).join(' ')).toLowerCase().includes(t);
  });
  const left = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {addSite ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="ph-in" autoFocus placeholder="Site name, e.g. Fairburn" aria-label="New site name" value={newSite} onChange={(e) => setNewSite(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createSite(); }} />
          <button type="button" className="ph-btn pri" onClick={createSite} disabled={!newSite.trim()}>Create</button>
          <button type="button" className="ph-btn" aria-label="Cancel" onClick={() => { setAddSite(false); setNewSite(''); }}>&times;</button>
        </div>
      ) : <button type="button" className="ph-btn pri" onClick={() => setAddSite(true)}>New site</button>}
      {(addSite || !selSite) && msg && <div style={{ fontSize: 14 }}><b>{msg}</b></div>}
      <div><input className="ph-in" list="ph-fc" placeholder="Country: all (click or type)" aria-label="Country" value={fc} onChange={(e) => setFc(e.target.value)} />{dl('ph-fc', [...new Set(siteArr.map((s) => s.country).filter(Boolean))].sort())}</div>
      <div><input className="ph-in" list="ph-fcity" placeholder="City: all (click or type)" aria-label="City" value={fcity} onChange={(e) => setFcity(e.target.value)} />{dl('ph-fcity', cities)}</div>
      <input className="ph-in" type="search" placeholder="Search site, city or project" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: wide ? 'auto' : 'visible', maxHeight: wide ? '58vh' : 'none' }}>
        <div className="muted" style={{ fontSize: 13 }}>{shown.length} site{shown.length === 1 ? '' : 's'}</div>
        {shown.map((s) => {
          const ps = projOf(s.id), t = q.trim().toLowerCase(), hit = t ? ps.filter((x) => (x.job + ' ' + (x.title || '')).toLowerCase().includes(t)) : [];
          return (
            <div key={s.id} className={'ph-card' + (s.id === selSite ? ' sel' : '')} role="button" tabIndex={0} onClick={() => openSite(s.id)} onKeyDown={(e) => { if (e.key === 'Enter') openSite(s.id); }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><b style={{ fontSize: 15 }}>{s.name}</b><span className="ph-tag" style={{ marginLeft: 'auto' }}>{ps.length} project{ps.length === 1 ? '' : 's'}</span></div>
              <div className="muted" style={{ fontSize: 13 }}>{[s.city, s.country].filter(Boolean).join(' · ') || 'No location yet'}</div>
              {hit.length > 0 && <div style={{ fontSize: 13, color: 'var(--acc)' }}>Matches: {hit.map((x) => x.job).join(', ')}</div>}
            </div>
          );
        })}
        {orphans.length > 0 && !q.trim() && !fc && !fcity && (
          <div className={'ph-card' + (selSite === '~' ? ' sel' : '')} role="button" tabIndex={0} onClick={() => openSite('~')} onKeyDown={(e) => { if (e.key === 'Enter') openSite('~'); }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><b style={{ fontSize: 15 }}>Projects without a site</b><span className="ph-tag" style={{ marginLeft: 'auto' }}>{orphans.length}</span></div>
            <div className="muted" style={{ fontSize: 13 }}>Move each one into a site</div>
          </div>
        )}
        {shown.length === 0 && orphans.length === 0 && <div className="muted" style={{ fontSize: 14 }}>{siteArr.length ? 'No match.' : 'No site yet. Press New site and give it a name, for example Fairburn.'}</div>}
      </div>
    </div>
  );

  // ----- rows (contacts / places) -----
  const rowsOf = (kind, mode) => { const r = []; ds[kind].forEach((x, i) => r.push({ x, lvl: 's', i })); if (mode === 'proj') dp[kind].forEach((x, i) => r.push({ x, lvl: 'p', i })); return r; };
  const setRow = (kind, lvl, i, k, v) => { if (lvl === 's') upS({ [kind]: ds[kind].map((x, j) => (j === i ? { ...x, [k]: v } : x)) }); else upP({ [kind]: dp[kind].map((x, j) => (j === i ? { ...x, [k]: v } : x)) }); };
  const delRow = (kind, lvl, i) => { if (lvl === 's') upS({ [kind]: ds[kind].filter((_, j) => j !== i) }); else upP({ [kind]: dp[kind].filter((_, j) => j !== i) }); };
  const addRow = (kind, mode) => { const blank = Object.fromEntries(FIELDS[kind].map((x) => [x[0], ''])); if (kind === 'contacts') blank.id = uid(); if (mode === 'site' || scope === 'site') upS({ [kind]: [...ds[kind], blank] }); else upP({ [kind]: [...dp[kind], blank] }); };
  const rowsUi = (kind, mode) => (
    <>
      {rowsOf(kind, mode).map((o) => (
        <div className="ph-row" key={o.lvl + o.i}>
          {FIELDS[kind].map(([k, ph, fl]) => <input key={k} className="ph-in" style={{ flex: fl, width: 'auto' }} list={k === 'role' ? 'ph-roles' : k === 'type' ? 'ph-places' : undefined} placeholder={ph} aria-label={ph} value={o.x[k] || ''} onChange={(e) => setRow(kind, o.lvl, o.i, k, e.target.value)} />)}
          {mode === 'proj' && <span className={'ph-tag' + (o.lvl === 's' ? ' s' : '')} title={o.lvl === 's' ? 'Shared by every project of this site' : 'Only this project'}>{o.lvl === 's' ? 'Site' : 'Project'}</span>}
          <button type="button" className="ph-btn" style={{ padding: '6px 10px' }} aria-label="Remove" onClick={() => delRow(kind, o.lvl, o.i)}>&times;</button>
        </div>
      ))}
      {rowsOf(kind, mode).length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Nothing yet.</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="ph-btn" onClick={() => addRow(kind, mode)}>{kind === 'contacts' ? 'Add contact' : 'Add place'}</button>
        {mode === 'proj' && (
          <select className="ph-in" style={{ width: 'auto' }} aria-label="Applies to" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="project">This project only</option>
            <option value="site">Whole site (every project of it)</option>
          </select>
        )}
      </div>
    </>
  );
  const effS = (w) => (ds.wf[w] ? 1 : 0);
  const effP = (w) => (dp.wf[w] !== undefined ? dp.wf[w] : ds.wf[w] ? 1 : 0);
  const saveBar = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="ph-btn pri" onClick={save} disabled={!dirty}>Save</button>
      {dirty && <span className="muted" style={{ fontSize: 14 }}>Unsaved changes (saved automatically when you click elsewhere)</span>}
      {msg && <b style={{ fontSize: 14 }}>{msg}</b>}
    </div>
  );

  // ----- right: a site -----
  const sitePanel = () => {
    const ps = projOf(selSite);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        {!wide && <div><button type="button" className="ph-btn" onClick={toList}>&larr; Sites</button></div>}
        <div>
          <div className="muted" style={{ fontSize: 13 }}>Site</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input className="ph-in" aria-label="Site name" value={ds.name} placeholder="Site name" onChange={(e) => upS({ name: e.target.value })} style={{ fontSize: 22, fontWeight: 600, flex: '1 1 220px', minWidth: 0 }} />
            <button type="button" className="ph-btn pri" onClick={save} disabled={!dirty}>Save</button>
          </div>
          <div className="muted" style={{ fontSize: 14 }}>{[ds.city, ds.country].filter(Boolean).join(' · ') || 'No location yet'}</div>
        </div>

        <div className="ph-sec">
          {head('loc', 'Where is this site')}
          {op.loc && (
            <div className="ph-body">
              <label><span className="ph-lab">Site name</span><input className="ph-in" value={ds.name} onChange={(e) => upS({ name: e.target.value })} /></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ flex: '1 1 150px' }}><span className="ph-lab">Country</span>
                  <input className="ph-in" list="ph-l-country" value={ds.country} placeholder="Type to search countries" onChange={(e) => upS({ country: e.target.value })} />
                  {dl('ph-l-country', [...new Set([...siteArr.map((s) => s.country).filter(Boolean), ...COUNTRIES.map((x) => x.n)])])}
                </label>
                <label style={{ flex: '1 1 150px' }}><span className="ph-lab">City</span>
                  <input className="ph-in" list="ph-l-city" value={ds.city} placeholder="Type to search cities" onChange={(e) => { const v = e.target.value, h = hits.find((x) => x.v === v); upS({ city: v, ...(h && !ds.country && h.country ? { country: h.country } : {}) }); setCityQ(h ? '' : v); }} />
                  {dl('ph-l-city', [...new Set([...siteArr.filter((s) => !ds.country || s.country === ds.country).map((s) => s.city).filter(Boolean), ...hits.map((x) => x.v)])])}
                </label>
              </div>
              <label><span className="ph-lab">Address</span><input className="ph-in" value={ds.address} placeholder="Street, city" onChange={(e) => upS({ address: e.target.value })} /></label>
              <label><span className="ph-lab">Coordinates (latitude, longitude)</span>
                <input className="ph-in" value={ct ?? fmt(ds)} placeholder="Paste coordinates" onChange={(e) => setCt(e.target.value)} onBlur={() => { if (ct !== null) { parseCt(ct); setCt(null); } }} onKeyDown={(e) => { if (e.key === 'Enter') { parseCt(ct ?? ''); setCt(null); } }} /></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="ph-btn" onClick={() => setMap('site')}>{ds.lat != null ? 'Show on map' : 'Pick on map'}</button>
                <button type="button" className="ph-btn" onClick={here}>Use my location</button>
                {ds.lat != null && <button type="button" className="ph-btn" onClick={() => { upS({ lat: null, lng: null }); setCt(null); }}>Clear pin</button>}
              </div>
              <div className="muted" style={{ fontSize: 13 }}>Pin it once. The city, country and address fill in by themselves. Every project in this site uses this place.</div>
            </div>
          )}
        </div>

        <div className="ph-sec">
          {head('about', 'How this site works (AI reads this)')}
          {op.about && (
            <div className="ph-body">
              <textarea className="ph-in" rows={5} placeholder="Explain in your own words how things work on this site: who decides what, the order of steps, anything a newcomer must know." value={ds.about || ''} onChange={(e) => upS({ about: e.target.value })} />
            </div>
          )}
        </div>

        <div className="ph-sec">
          {head('book', 'Contact book', ds.contacts.length)}
          {op.book && <div className="ph-body"><div className="muted" style={{ fontSize: 13 }}>Add each person once. The orientation card picks them from here, and every project of this site sees them.</div>{rowsUi('contacts', 'site')}</div>}
        </div>

        <div className="ph-sec">
          {head('ori', 'Orientation')}
          {op.ori && (
            <div className="ph-body">
              <div className="muted" style={{ fontSize: 13 }}>The meeting everyone attends before entering the site. It is usually held somewhere else, so it has its own place.</div>
              <label><span className="ph-lab">When</span><input className="ph-in" value={o.when || ''} placeholder="Mondays 7:30 AM" onChange={(e) => upO({ when: e.target.value })} /></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['callId', 'Call before you come'], ['mailId', 'Send the email to']].map(([f, nm]) => (
                  <label key={f} style={{ flex: '1 1 200px' }}><span className="ph-lab">{nm}</span>
                    <select className="ph-in" value={idxOf(o[f])} onChange={(e) => pickPerson(f, e.target.value)}>
                      <option value="">{ds.contacts.length ? 'Choose a person…' : 'Add people to the contact book first'}</option>
                      {ds.contacts.map((c, i) => <option key={i} value={i}>{[c.name || 'No name', c.role, f === 'mailId' ? c.email : c.phone].filter(Boolean).join(' · ')}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <label><span className="ph-lab">Where it is held</span><input className="ph-in" value={o.where || ''} placeholder="Name of the place, e.g. Grace Church" onChange={(e) => upO({ where: e.target.value })} /></label>
              <label><span className="ph-lab">Address</span><input className="ph-in" value={o.address || ''} placeholder="Street, city" onChange={(e) => upO({ address: e.target.value })} /></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="ph-btn" onClick={() => setMap('ori')}>{o.lat != null ? 'Show on map' : 'Pick on map'}</button>
                {o.lat != null && <button type="button" className="ph-btn" onClick={() => upO({ lat: null, lng: null })}>Clear pin</button>}
                {o.lat != null && <span className="muted" style={{ fontSize: 13 }}>{fmt(o)}</span>}
              </div>
              <div>
                <span className="ph-lab">Forms and rules (4 MB per file)</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {(o.files || []).map((f, i) => (
                    <span key={i} className="ph-tag" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 14, padding: '4px 10px' }}>
                      <a href={'/api/admin/sitefile?p=' + encodeURIComponent(f.path) + '&raw=1'} target="_blank" rel="noreferrer">{f.name}</a>
                      <button type="button" aria-label={'Remove ' + f.name} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 16 }} onClick={() => upO({ files: o.files.filter((_, j) => j !== i) })}>&times;</button>
                    </span>
                  ))}
                  <label className="ph-btn" style={{ cursor: 'pointer' }}>Add file<input type="file" hidden onChange={(e) => { addFile(e.target.files[0]); e.target.value = ''; }} /></label>
                </div>
              </div>
              <label><span className="ph-lab">Rules (shown to workers on the share page)</span><textarea className="ph-in" rows={3} value={o.rules || ''} onChange={(e) => upO({ rules: e.target.value })} /></label>
              <label><span className="ph-lab">How it works (AI reads this, not shown to workers)</span><textarea className="ph-in" rows={4} placeholder="Everyone attends before the first day. Call the HSE lead first, then email the signed form…" value={o.how || ''} onChange={(e) => upO({ how: e.target.value })} /></label>
            </div>
          )}
        </div>

        <div className="ph-sec">
          {head('guide', 'Site guide map', ds.places.filter((p) => p.lat != null).length + ' pins')}
          {op.guide && (
            <div className="ph-body">
              <div className="muted" style={{ fontSize: 13 }}>Pick a pin type, then click the aerial view. Drag a pin to move it.{ds.lat == null && !ds.places.some((p) => p.lat != null) ? ' Pin the site above first so the map opens at the right place.' : ''}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.keys(PIN_TYPES).map((k) => <button key={k} type="button" className="ph-btn" style={{ padding: '5px 10px', fontSize: 14, ...(gType === k ? { background: '#e3f1f2', borderColor: 'var(--acc)' } : {}) }} onClick={() => setGType(k)}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: PIN_TYPES[k], marginRight: 6 }} />{k}</button>)}
              </div>
              <GuideMap editable pins={ds.places} center={ds.lat != null ? { lat: ds.lat, lng: ds.lng } : null}
                onAdd={(la, lo) => upS({ places: [...ds.places, { type: gType, where: '', lat: la, lng: lo }] })}
                onMove={(i, la, lo) => upS({ places: ds.places.map((p, j) => (j === i ? { ...p, lat: la, lng: lo } : p)) })} />
              {ds.places.map((p, i) => (
                <div className="ph-row" key={i}>
                  <input className="ph-in" style={{ flex: '1 1 130px', width: 'auto' }} list="ph-places" placeholder="Type" aria-label="Type" value={p.type || ''} onChange={(e) => upS({ places: ds.places.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })} />
                  <input className="ph-in" style={{ flex: '2 1 200px', width: 'auto' }} placeholder="Where it is, e.g. east gate" aria-label="Where it is" value={p.where || ''} onChange={(e) => upS({ places: ds.places.map((x, j) => (j === i ? { ...x, where: e.target.value } : x)) })} />
                  <span className={'ph-tag' + (p.lat != null ? ' s' : '')}>{p.lat != null ? 'On the map' : 'No pin'}</span>
                  <button type="button" className="ph-btn" style={{ padding: '6px 10px' }} aria-label="Remove" onClick={() => upS({ places: ds.places.filter((_, j) => j !== i) })}>&times;</button>
                </div>
              ))}
              <div className="ph-note">
                {ds.guide ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div><b>Share link is on.</b> Anyone with this link sees the map, the orientation card and its contacts. No login.</div>
                    <input className="ph-in" readOnly value={gurl} onFocus={(e) => e.target.select()} aria-label="Share link" />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="ph-btn" onClick={() => navigator.clipboard.writeText(gurl).then(() => setMsg('Link copied'), () => setMsg('Could not copy'))}>Copy link</button>
                      <a className="ph-btn" href={gurl} target="_blank" rel="noreferrer">Open</a>
                      <button type="button" className="ph-btn" onClick={() => guideLink(false)}>Turn off</button>
                    </div>
                    <div style={{ fontSize: 13 }}>The page shows what is saved. Press Save first when you change something.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>Give workers a link to this map and the orientation card. They open it on their phone, no login. Anyone who has the link can see it, including the phone and email of the people picked above.</div>
                    <div><button type="button" className="ph-btn" onClick={() => guideLink(true)}>Create share link</button></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ph-sec">
          {head('wf', 'Workflows shared by all projects', WORKFLOWS.filter((w) => effS(w)).length + ' on')}
          {op.wf && (
            <div className="ph-body">
              {WORKFLOWS.map((w) => (
                <div className="ph-row" key={w}>
                  <div style={{ flex: 1, minWidth: 140 }}>{w}</div>
                  <button type="button" role="switch" aria-checked={!!effS(w)} aria-label={w} className={'ph-sw' + (effS(w) ? ' on' : '')} onClick={() => upS({ wf: { ...ds.wf, [w]: effS(w) ? 0 : 1 } })} />
                </div>
              ))}
              <div className="muted" style={{ fontSize: 13 }}>A project can still turn any of these on or off for itself.</div>
            </div>
          )}
        </div>

        <div className="ph-sec">
          {head('projs', 'Projects in this site', ps.length)}
          {op.projs && (
            <div className="ph-body">
              {addProj ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="ph-in" autoFocus placeholder="Project name, e.g. ATL5" aria-label="New project name" value={newProj} onChange={(e) => setNewProj(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createProject(); }} />
                  <button type="button" className="ph-btn pri" onClick={createProject} disabled={!newProj.trim()}>Create</button>
                  <button type="button" className="ph-btn" aria-label="Cancel" onClick={() => { setAddProj(false); setNewProj(''); }}>&times;</button>
                </div>
              ) : <div><button type="button" className="ph-btn pri" onClick={() => setAddProj(true)}>New project</button></div>}
              {ps.map((x) => (
                <div key={x.job} className="ph-card" role="button" tabIndex={0} onClick={() => openProj(x.job)} onKeyDown={(e) => { if (e.key === 'Enter') openProj(x.job); }} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <b style={{ fontSize: 15 }}>{x.job}</b>{x.title && <span className="muted" style={{ fontSize: 13 }}>{x.title}</span>}
                  {x.state !== 'active' && <span className="ph-tag" style={{ marginLeft: 'auto' }}>{x.state}</span>}<span className="ph-tag s" style={x.state !== 'active' ? {} : { marginLeft: 'auto' }}>Open</span>
                </div>
              ))}
              {ps.length === 0 && !addProj && <div className="muted" style={{ fontSize: 14 }}>No project yet. Press New project and give it a name, for example ATL1.</div>}
            </div>
          )}
        </div>

        {saveBar}
        {ps.length === 0 && <div><button type="button" className="ph-btn" onClick={removeSite}>Delete this site</button></div>}
      </div>
    );
  };

  // ----- right: a project -----
  const projPanel = () => {
    const info = (jobs || []).find((x) => x.job === selProj);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        {!wide && <div><button type="button" className="ph-btn" onClick={toSite}>&larr; {ds.name || 'Site'}</button></div>}
        <div className="ph-bc"><a onClick={toSite}>{ds.name || 'Site'}</a><span>&rsaquo;</span><span style={{ color: 'var(--ink)' }}>{selProj}</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><h2 style={{ margin: 0, fontSize: 22 }}>{selProj}</h2>{info && info.title && <span className="muted">{info.title}</span>}</div>
        <div className="ph-note">Location from the site: {[ds.name, ds.city, ds.country].filter(Boolean).join(', ')}{ds.address ? ' · ' + ds.address : ''}</div>
        <label style={{ maxWidth: 360 }}><span className="ph-lab">Site of this project</span>
          <select className="ph-in" value={dp.siteId || selSite} onChange={(e) => upP({ siteId: e.target.value })}>
            {siteArr.map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ' · ' + s.city : ''}</option>)}
          </select>
        </label>
        <div className="ph-tabs" role="tablist">{TABS.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tab === 'Contacts' && rowsUi('contacts', 'proj')}
          {tab === 'Places' && rowsUi('places', 'proj')}
          {tab === 'Workflow' && (
            <>
              {WORKFLOWS.map((w) => {
                const own = dp.wf[w] !== undefined;
                return (
                  <div className="ph-row" key={w}>
                    <div style={{ flex: 1, minWidth: 140 }}>{w}</div>
                    {own && <button type="button" className="ph-btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => { const n = { ...dp.wf }; delete n[w]; upP({ wf: n }); }}>Use site default</button>}
                    <span className={'ph-tag' + (own ? '' : ' s')}>{own ? 'Project' : 'Site default'}</span>
                    <button type="button" role="switch" aria-checked={!!effP(w)} aria-label={w} className={'ph-sw' + (effP(w) ? ' on' : '')} onClick={() => upP({ wf: { ...dp.wf, [w]: effP(w) ? 0 : 1 } })} />
                  </div>
                );
              })}
            </>
          )}
          {tab === 'Sections & QR' && <Projects key={selProj} fixedJob={selProj} />}
        </div>
        {tab !== 'Sections & QR' && saveBar}
      </div>
    );
  };

  // ----- right: projects that have no site yet -----
  const orphanPanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {!wide && <div><button type="button" className="ph-btn" onClick={toList}>&larr; Sites</button></div>}
      <h2 style={{ margin: 0, fontSize: 22 }}>Projects without a site</h2>
      <div className="muted" style={{ fontSize: 14 }}>Pick the site each project is in. Create the site first if it is not in the list.</div>
      {msg && <b style={{ fontSize: 14 }}>{msg}</b>}
      {orphans.map((x) => (
        <div className="ph-row" key={x.job}>
          <b style={{ flex: '1 1 120px' }}>{x.job}{x.title ? <span className="muted" style={{ fontWeight: 400 }}> · {x.title}</span> : null}</b>
          <select className="ph-in" style={{ flex: '1 1 180px', width: 'auto' }} aria-label={'Site of ' + x.job} value="" onChange={(e) => assign(x.job, e.target.value)}>
            <option value="">Choose a site…</option>
            {siteArr.map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ' · ' + s.city : ''}</option>)}
          </select>
        </div>
      ))}
      {orphans.length === 0 && <div className="muted">Every project is in a site.</div>}
    </div>
  );

  const right = selSite === '~' ? orphanPanel() : selSite && selProj ? projPanel() : selSite ? sitePanel() : <div className="muted" style={{ margin: 'auto', textAlign: 'center', padding: '60px 0' }}>Pick a site, or create one, to open it</div>;

  if (jobs === null) return <p className="muted">{msg || 'Loading…'}</p>;
  return (
    <>
      <style>{CSS}</style>
      {wide ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,290px) minmax(0,1fr)', border: '1px solid var(--line)', borderRadius: 10, background: '#fff', minHeight: 480 }}>
          <div style={{ borderRight: '1px solid var(--line)', padding: 12, minWidth: 0 }}>{left}</div>
          <div style={{ padding: '14px 18px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>{right}</div>
        </div>
      ) : selSite ? right : left}
      {dl('ph-roles', ROLES)}{dl('ph-places', PLACES)}
      {map === 'site' && <MapPicker title={'Location of ' + (ds.name || 'site')} lat={ds.lat} lng={ds.lng} onSave={(p) => { upS({ lat: p.lat, lng: p.lng }); setCt(null); fillFrom(p.lat, p.lng); return true; }} onClose={() => setMap('')} />}
      {map === 'ori' && <MapPicker title={'Orientation place of ' + (ds.name || 'site')} lat={o.lat} lng={o.lng} onSave={(p) => { upO({ lat: p.lat, lng: p.lng }); fillOri(p.lat, p.lng); return true; }} onClose={() => setMap('')} />}
    </>
  );
}
