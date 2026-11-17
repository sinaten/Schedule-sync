'use client';
import { useEffect, useState, useCallback } from 'react';
import MapPicker from './MapPicker';
import Projects from './Projects';
import { WORKFLOWS, siteKey } from '../../lib/projmeta';

// Admin > Projects. Left: Country / City / Site filters and the list of projects. Right (a full page on phones): the settings of the chosen project.
// Anything marked "Site" is shared by every project of that site; "Project" belongs to this project only.
const EMPTY = { country: '', city: '', site: '', address: '', lat: null, lng: null, contacts: [], places: [], wf: {} };
const NOSITE = { contacts: [], places: [], wf: {} };
const ROLES = ['HSE officer', 'Project manager', 'Site manager', 'Security', 'Emergency', 'Facility manager'];
const PLACES = ['Parking', 'Restroom', 'First aid', 'Muster point', 'Entrance', 'Canteen', 'Fire extinguisher', 'Storage'];
const FIELDS = { contacts: [['role', 'Role', '1 1 130px'], ['name', 'Name', '1 1 130px'], ['phone', 'Phone', '1 1 130px']], places: [['type', 'Place', '1 1 140px'], ['where', 'Where it is', '2 1 200px']] };
const TABS = ['Location', 'Contacts', 'Places', 'Workflow', 'Sections & QR'];
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
`;

export default function ProjectHub() {
  const [jobs, setJobs] = useState(null);
  const [meta, setMeta] = useState({});
  const [sites, setSites] = useState({});
  const [f, setF] = useState(['', '', '']);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('');
  const [tab, setTab] = useState('Location');
  const [scope, setScope] = useState('project');
  const [screen, setScreen] = useState('list');
  const [msg, setMsg] = useState('');
  const [wide, setWide] = useState(true);
  const [dp, setDp] = useState(EMPTY);
  const [sd, setSd] = useState({});
  const [dirtyP, setDirtyP] = useState(false);
  const [dirtyS, setDirtyS] = useState({});
  const [ct, setCt] = useState(null);
  const [map, setMap] = useState(false);
  const [un, setUn] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [cityQ, setCityQ] = useState('');
  const [hits, setHits] = useState([]);

  useEffect(() => {
    const fn = () => setWide(window.innerWidth >= 760);
    fn(); window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch('/api/admin/jobs', { cache: 'no-store' }), fetch('/api/admin/projmeta', { cache: 'no-store' })]);
    if (!a.ok || !b.ok) { setMsg('Could not load projects (' + (a.ok ? b.status : a.status) + ')'); setJobs([]); return; }
    const ja = await a.json(), jb = await b.json();
    const base = ja.jobs || [], have = new Set(base.map((x) => x.job));
    const extra = Object.keys(jb.meta || {}).filter((k) => !have.has(k)).map((k) => ({ job: k, state: 'active', title: '' }));
    setJobs([...base, ...extra].sort((a, b) => a.job.localeCompare(b.job, undefined, { numeric: true }))); setMeta(jb.meta || {}); setSites(jb.sites || {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = cityQ.trim();
    if (t.length < 2) { setHits([]); return; }
    let dead = false;
    const id = setTimeout(async () => {
      try {
        const cc = codeOf(dp.country);
        const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(t) + '&count=8&language=en&format=json' + (cc ? '&countryCode=' + cc : ''));
        const j = await r.json();
        if (!dead) setHits((j.results || []).map((x) => ({ v: x.name + (x.admin1 ? ', ' + x.admin1 : ''), country: nameOf(x.country_code) || x.country || '' })));
      } catch (e) { if (!dead) setHits([]); }
    }, 300);
    return () => { dead = true; clearTimeout(id); };
  }, [cityQ, dp.country]);

  const dirty = dirtyP || Object.keys(dirtyS).length > 0;
  const key = siteKey(dp);
  const site = key ? sd[key] || sites[key] || NOSITE : null;
  const upP = (patch) => { setDp((x) => ({ ...x, ...patch })); setDirtyP(true); };
  const upS = (patch) => { if (!key) return; setSd((x) => ({ ...x, [key]: { ...(x[key] || sites[key] || NOSITE), ...patch } })); setDirtyS((x) => ({ ...x, [key]: 1 })); };

  const pick = (job) => {
    if (job === sel) { setScreen('detail'); return; }
    if (dirty && !confirm('Discard the unsaved changes of this project?')) return;
    setSel(job); setDp({ ...EMPTY, ...(meta[job] || {}) }); setSd({}); setDirtyP(false); setDirtyS({}); setCt(null); setTab('Location'); setScope('project'); setMsg(''); setScreen('detail');
  };
  const back = () => { if (dirty && !confirm('Discard the unsaved changes of this project?')) return; setScreen('list'); setSel(''); setDirtyP(false); setDirtyS({}); };

  async function create() {
    const name = newName.trim();
    if (!name) return;
    if (name.includes('>') || name.length > 80) { setMsg('Use a shorter name without the > sign'); return; }
    if ((jobs || []).some((x) => x.job.toLowerCase() === name.toLowerCase())) { setMsg('A project with this name already exists'); return; }
    setMsg('Creating…');
    const r = await fetch('/api/admin/projmeta', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job: name, meta: { ...EMPTY, country: f[0] && f[0] !== '~' ? f[0] : '', city: f[1] || '', site: f[2] || '' } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Failed (' + r.status + ')'); return; }
    setNewName(''); setAdding(false);
    const [a, b] = await Promise.all([fetch('/api/admin/jobs', { cache: 'no-store' }), fetch('/api/admin/projmeta', { cache: 'no-store' })]);
    const ja = await a.json(), jb = await b.json();
    const base = ja.jobs || [], have = new Set(base.map((x) => x.job));
    const extra = Object.keys(jb.meta || {}).filter((k) => !have.has(k)).map((k) => ({ job: k, state: 'active', title: '' }));
    setJobs([...base, ...extra].sort((x, y) => x.job.localeCompare(y.job, undefined, { numeric: true }))); setMeta(jb.meta || {}); setSites(jb.sites || {});
    setSel(name); setDp({ ...EMPTY, ...(jb.meta[name] || {}) }); setSd({}); setDirtyP(false); setDirtyS({}); setCt(null); setTab('Location'); setScope('project'); setScreen('detail'); setMsg('Project created. Now set where it is.');
  }

  // After a pin or GPS fix: read the address, city and country from the coordinates and fill the empty fields (never overwrites what you typed).
  async function fillFrom(lat, lng) {
    try {
      const r = await fetch('https://photon.komoot.io/reverse?lang=en&lat=' + lat + '&lon=' + lng);
      const j = await r.json();
      const p = j && j.features && j.features[0] && j.features[0].properties;
      if (!p) { setMsg('Pin saved, but no address was found here. Type the city and country.'); return; }
      const town = p.city || p.town || p.village || p.district || p.county || '';
      const city = town ? town + (p.state ? ', ' + p.state : '') : '';
      const street = [p.housenumber, p.street].filter(Boolean).join(' ') || p.name || '';
      const address = [street, town, [p.state, p.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      const country = nameOf(p.countrycode) || p.country || '';
      setDp((x) => ({ ...x, country: x.country || country, city: x.city || city, address: x.address || address }));
      setDirtyP(true); setMsg('Address, city and country filled from the pin. Check them and press Save.');
    } catch (e) { setMsg('Pin saved, but the address lookup did not work. Type the city and country.'); }
  }

  async function save() {
    setMsg('Saving…');
    const put = async (body) => { const r = await fetch('/api/admin/projmeta', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Failed (' + r.status + ')'); };
    try {
      await put({ job: sel, meta: dp });
      for (const k of Object.keys(dirtyS)) await put({ site: k, data: sd[k] });
      setDirtyP(false); setDirtyS({}); setSd({}); setMsg('Saved');
      await load();
    } catch (e) { setMsg(e.message); }
  }

  const here = () => {
    if (!navigator.geolocation) { setMsg('This device has no location'); return; }
    setMsg('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (p) => { upP({ lat: p.coords.latitude, lng: p.coords.longitude }); setCt(null); setMsg('Got your location (±' + Math.round(p.coords.accuracy) + ' m). Press Save.'); fillFrom(p.coords.latitude, p.coords.longitude); },
      (e) => setMsg(e && e.code === 1 ? 'Location is blocked. Allow it for this site.' : 'Could not get the location. Try outside.'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };
  const parseCt = (t) => {
    const m = String(t).match(/-?\d+(?:\.\d+)?/g);
    if (!String(t).trim()) { upP({ lat: null, lng: null }); return; }
    if (m && m.length >= 2 && Math.abs(+m[0]) <= 90 && Math.abs(+m[1]) <= 180) upP({ lat: +m[0], lng: +m[1] }); else setMsg('Use two numbers: latitude, longitude');
  };

  // Filters
  const all = (jobs || []).map((x) => ({ ...x, m: meta[x.job] || EMPTY }));
  const opts = (l) => { const s = new Set(); all.forEach((x) => { const a = [x.m.country, x.m.city, x.m.site]; for (let i = 0; i < l; i++) if (f[i] && !a[i].toLowerCase().includes(f[i].trim().toLowerCase())) return; if (a[l]) s.add(a[l]); }); return [...s].sort((a, b) => a.localeCompare(b)); };
  const shown = all.filter((x) => {
    const a = [x.m.country, x.m.city, x.m.site];
    if (un) { if (siteKey(x.m)) return false; } else for (let i = 0; i < 3; i++) if (f[i].trim() && !a[i].toLowerCase().includes(f[i].trim().toLowerCase())) return false;
    const t = q.trim().toLowerCase();
    return !t || (x.job + ' ' + (x.title || '') + ' ' + a.join(' ')).toLowerCase().includes(t);
  });
  const setLv = (l, v) => { const n = f.slice(); n[l] = v; setF(n); };
  const dl = (id, arr) => <datalist id={id}>{arr.map((x) => <option key={x} value={x} />)}</datalist>;
  const near = (l) => { const s = new Set(); all.forEach((x) => { const a = [x.m.country, x.m.city, x.m.site]; for (let i = 0; i < l; i++) if (a[i] !== [dp.country, dp.city][i]) return; if (a[l]) s.add(a[l]); }); return [...s]; };

  const assigned = all.some((x) => siteKey(x.m));
  const filters = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {adding ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="ph-in" autoFocus placeholder="Project name, e.g. ATL2" aria-label="New project name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
          <button type="button" className="ph-btn pri" onClick={create} disabled={!newName.trim()}>Create</button>
          <button type="button" className="ph-btn" aria-label="Cancel" onClick={() => { setAdding(false); setNewName(''); }}>&times;</button>
        </div>
      ) : <button type="button" className="ph-btn pri" onClick={() => setAdding(true)}>New project</button>}
      {(adding || !sel) && msg && <div style={{ fontSize: 14 }}><b>{msg}</b></div>}
      {['Country', 'City', 'Site'].map((nm, i) => (
        <div key={nm}>
          <input className="ph-in" list={'ph-f' + i} placeholder={nm + ': all (click or type)'} aria-label={nm} value={f[i]} disabled={un} onChange={(e) => setLv(i, e.target.value)} />
          {dl('ph-f' + i, opts(i))}
        </div>
      ))}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={un} onChange={(e) => setUn(e.target.checked)} /> Not assigned yet only</label>
      {!assigned && <div className="muted" style={{ fontSize: 13 }}>No project has a country, city and site yet. Open a project and fill in Location, then they show up here.</div>}
      <input className="ph-in" type="search" placeholder="Search projects" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
  );
  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="muted" style={{ fontSize: 13 }}>{shown.length} project{shown.length === 1 ? '' : 's'}</div>
      {shown.map((x) => (
        <div key={x.job} className={'ph-card' + (x.job === sel ? ' sel' : '')} onClick={() => pick(x.job)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') pick(x.job); }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><b style={{ fontSize: 15 }}>{x.job}</b>{x.state !== 'active' && <span className="ph-tag" style={{ marginLeft: 'auto' }}>{x.state}</span>}</div>
          <div className="muted" style={{ fontSize: 13 }}>{x.title ? x.title + ' · ' : ''}{x.m.site ? x.m.site + (x.m.city ? ', ' + x.m.city : '') : 'Not assigned yet'}</div>
        </div>
      ))}
      {shown.length === 0 && <div className="muted" style={{ fontSize: 14 }}>No match.</div>}
    </div>
  );

  // Settings of the chosen project
  const rowsOf = (kind) => {
    const r = [];
    if (site) site[kind].forEach((x, i) => r.push({ x, lvl: 's', i }));
    dp[kind].forEach((x, i) => r.push({ x, lvl: 'p', i }));
    return r;
  };
  const setRow = (kind, lvl, i, k, v) => { if (lvl === 's') upS({ [kind]: site[kind].map((x, j) => (j === i ? { ...x, [k]: v } : x)) }); else upP({ [kind]: dp[kind].map((x, j) => (j === i ? { ...x, [k]: v } : x)) }); };
  const delRow = (kind, lvl, i) => { if (lvl === 's') upS({ [kind]: site[kind].filter((_, j) => j !== i) }); else upP({ [kind]: dp[kind].filter((_, j) => j !== i) }); };
  const addRow = (kind) => { const blank = Object.fromEntries(FIELDS[kind].map((x) => [x[0], ''])); if (scope === 'site' && site) upS({ [kind]: [...site[kind], blank] }); else upP({ [kind]: [...dp[kind], blank] }); };
  const scopeSel = (
    <select className="ph-in" style={{ width: 'auto' }} aria-label="Applies to" value={scope} onChange={(e) => setScope(e.target.value)}>
      <option value="project">This project only</option>
      <option value="site" disabled={!site}>Whole site (every project of it)</option>
    </select>
  );
  const noSite = !site && <p className="muted" style={{ fontSize: 14, margin: 0 }}>Set the country, city and site in Location to share things with the other projects of the same site.</p>;
  const rowsUi = (kind) => (
    <>
      {noSite}
      {rowsOf(kind).map((o) => (
        <div className="ph-row" key={o.lvl + o.i}>
          {FIELDS[kind].map(([k, ph, fl]) => <input key={k} className="ph-in" style={{ flex: fl, width: 'auto' }} list={k === 'role' ? 'ph-roles' : k === 'type' ? 'ph-places' : undefined} placeholder={ph} aria-label={ph} value={o.x[k] || ''} onChange={(e) => setRow(kind, o.lvl, o.i, k, e.target.value)} />)}
          <span className={'ph-tag' + (o.lvl === 's' ? ' s' : '')} title={o.lvl === 's' ? 'Shared by every project of this site' : 'Only this project'}>{o.lvl === 's' ? 'Site' : 'Project'}</span>
          <button type="button" className="ph-btn" style={{ padding: '6px 10px' }} aria-label="Remove" onClick={() => delRow(kind, o.lvl, o.i)}>&times;</button>
        </div>
      ))}
      {rowsOf(kind).length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Nothing yet.</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="ph-btn" onClick={() => addRow(kind)}>{kind === 'contacts' ? 'Add contact' : 'Add place'}</button>{scopeSel}
      </div>
    </>
  );
  const eff = (w) => (scope === 'site' && site ? (site.wf[w] ? 1 : 0) : dp.wf[w] !== undefined ? dp.wf[w] : site && site.wf[w] ? 1 : 0);
  const flip = (w) => { if (scope === 'site' && site) upS({ wf: { ...site.wf, [w]: site.wf[w] ? 0 : 1 } }); else upP({ wf: { ...dp.wf, [w]: eff(w) ? 0 : 1 } }); };
  const reset = (w) => { const n = { ...dp.wf }; delete n[w]; upP({ wf: n }); };

  const body = () => {
    if (tab === 'Location') {
      return (
        <>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>{key ? 'This project is in ' + key.split('>').join(' › ') + '.' : 'Not in the tree yet. Fill in the country, city and site below.'}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 150px' }}><span className="ph-lab">Country</span>
              <input className="ph-in" list="ph-l-country" value={dp.country} placeholder="Type to search countries" onChange={(e) => upP({ country: e.target.value })} />
              {dl('ph-l-country', [...new Set([...near(0), ...COUNTRIES.map((x) => x.n)])])}
            </label>
            <label style={{ flex: '1 1 150px' }}><span className="ph-lab">City</span>
              <input className="ph-in" list="ph-l-city" value={dp.city} placeholder="Type to search cities" onChange={(e) => { const v = e.target.value, h = hits.find((x) => x.v === v); upP({ city: v, ...(h && !dp.country && h.country ? { country: h.country } : {}) }); setCityQ(h ? '' : v); }} />
              {dl('ph-l-city', [...new Set([...near(1), ...hits.map((x) => x.v)])])}
            </label>
            <label style={{ flex: '1 1 150px' }}><span className="ph-lab">Site</span>
              <input className="ph-in" list="ph-l-site" value={dp.site} placeholder="Building or plant name" onChange={(e) => upP({ site: e.target.value })} />
              {dl('ph-l-site', near(2))}
            </label>
          </div>
          <label><span className="ph-lab">Address</span><input className="ph-in" value={dp.address} placeholder="Street, city" onChange={(e) => upP({ address: e.target.value })} /></label>
          <label><span className="ph-lab">Coordinates (latitude, longitude)</span>
            <input className="ph-in" value={ct ?? fmt(dp)} placeholder="Paste coordinates" onChange={(e) => setCt(e.target.value)} onBlur={() => { if (ct !== null) { parseCt(ct); setCt(null); } }} onKeyDown={(e) => { if (e.key === 'Enter') { parseCt(ct ?? ''); setCt(null); } }} /></label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="ph-btn" onClick={here}>Use my location</button>
            <button type="button" className="ph-btn" onClick={() => setMap(true)}>{dp.lat != null ? 'Show on map' : 'Pick on map'}</button>
            {dp.lat != null && <button type="button" className="ph-btn" onClick={() => { upP({ lat: null, lng: null }); setCt(null); }}>Clear</button>}
          </div>
        </>
      );
    }
    if (tab === 'Contacts') return <>{rowsUi('contacts')}</>;
    if (tab === 'Places') return <>{rowsUi('places')}</>;
    if (tab === 'Workflow') {
      return (
        <>
          {noSite}
          {WORKFLOWS.map((w) => {
            const own = scope === 'project' && dp.wf[w] !== undefined;
            return (
              <div className="ph-row" key={w}>
                <div style={{ flex: 1, minWidth: 140 }}>{w}</div>
                {scope === 'project' && own && <button type="button" className="ph-btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => reset(w)}>Use site default</button>}
                <span className={'ph-tag' + (own ? '' : ' s')}>{scope === 'site' ? 'Site default' : own ? 'Project' : 'Site default'}</span>
                <button type="button" role="switch" aria-checked={!!eff(w)} aria-label={w} className={'ph-sw' + (eff(w) ? ' on' : '')} onClick={() => flip(w)} />
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><span className="muted" style={{ fontSize: 14 }}>Switch applies to</span>{scopeSel}</div>
        </>
      );
    }
    return <Projects key={sel} fixedJob={sel} />;
  };

  const info = all.find((x) => x.job === sel);
  const panel = !sel ? (
    <div className="muted" style={{ margin: 'auto', textAlign: 'center', padding: '60px 0' }}>Pick a project to open its settings</div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      {!wide && <div><button type="button" className="ph-btn" onClick={back}>&larr; Projects</button></div>}
      <div>
        <div className="muted" style={{ fontSize: 13 }}>{key ? key.split('>').join(' › ') : 'Not assigned yet'}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 20 }}>{sel}</h2>{info && info.title && <span className="muted">{info.title}</span>}</div>
      </div>
      <div className="ph-tabs" role="tablist">{TABS.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{body()}</div>
      {tab !== 'Sections & QR' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="ph-btn pri" onClick={save} disabled={!dirty}>Save</button>
          {dirty && <span className="muted" style={{ fontSize: 14 }}>Unsaved changes</span>}
          {msg && <b style={{ fontSize: 14 }}>{msg}</b>}
        </div>
      )}
      {dl('ph-roles', ROLES)}{dl('ph-places', PLACES)}
    </div>
  );

  if (jobs === null) return <p className="muted">{msg || 'Loading…'}</p>;
  return (
    <>
      <style>{CSS}</style>
      {jobs.length === 0 ? <p className="muted">No projects yet. They appear here after the first Revit sync.{msg && <b style={{ marginLeft: 8 }}>{msg}</b>}</p> : wide ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,280px) minmax(0,1fr)', gap: 0, border: '1px solid var(--line)', borderRadius: 10, background: '#fff', minHeight: 460 }}>
          <div style={{ borderRight: '1px solid var(--line)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>{filters}<div style={{ overflow: 'auto', maxHeight: '60vh' }}>{list}</div></div>
          <div style={{ padding: '14px 18px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>{panel}</div>
        </div>
      ) : screen === 'list' || !sel ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{filters}{list}</div>
      ) : panel}
      {map && <MapPicker title={'Location of ' + sel} lat={dp.lat} lng={dp.lng} onSave={(p) => { upP({ lat: p.lat, lng: p.lng }); setCt(null); fillFrom(p.lat, p.lng); return true; }} onClose={() => setMap(false)} />}
    </>
  );
}
