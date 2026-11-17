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

  useEffect(() => {
    const fn = () => setWide(window.innerWidth >= 760);
    fn(); window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch('/api/admin/jobs', { cache: 'no-store' }), fetch('/api/admin/projmeta', { cache: 'no-store' })]);
    if (!a.ok || !b.ok) { setMsg('Could not load projects (' + (a.ok ? b.status : a.status) + ')'); setJobs([]); return; }
    const ja = await a.json(), jb = await b.json();
    setJobs(ja.jobs || []); setMeta(jb.meta || {}); setSites(jb.sites || {});
  }, []);
  useEffect(() => { load(); }, [load]);

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
      (p) => { upP({ lat: p.coords.latitude, lng: p.coords.longitude }); setCt(null); setMsg('Got your location (±' + Math.round(p.coords.accuracy) + ' m). Press Save.'); },
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
  const opts = (l) => { const s = new Set(); all.forEach((x) => { const a = [x.m.country, x.m.city, x.m.site]; for (let i = 0; i < l; i++) if (f[i] && f[i] !== '~' && a[i] !== f[i]) return; if (a[l]) s.add(a[l]); }); return [...s].sort((a, b) => a.localeCompare(b)); };
  const shown = all.filter((x) => {
    const a = [x.m.country, x.m.city, x.m.site];
    if (f[0] === '~') { if (siteKey(x.m)) return false; } else for (let i = 0; i < 3; i++) if (f[i] && a[i] !== f[i]) return false;
    const t = q.trim().toLowerCase();
    return !t || (x.job + ' ' + (x.title || '') + ' ' + a.join(' ')).toLowerCase().includes(t);
  });
  const setLv = (l, v) => { const n = f.slice(); n[l] = v; for (let i = l + 1; i < 3; i++) n[i] = ''; setF(n); };
  const dl = (id, arr) => <datalist id={id}>{arr.map((x) => <option key={x} value={x} />)}</datalist>;
  const near = (l) => { const s = new Set(); all.forEach((x) => { const a = [x.m.country, x.m.city, x.m.site]; for (let i = 0; i < l; i++) if (a[i] !== [dp.country, dp.city][i]) return; if (a[l]) s.add(a[l]); }); return [...s]; };

  const filters = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select className="ph-in" aria-label="Country" value={f[0]} onChange={(e) => setLv(0, e.target.value)}>
        <option value="">Country: all</option>
        {opts(0).map((o) => <option key={o}>{o}</option>)}
        <option value="~">Not assigned yet</option>
      </select>
      {['City', 'Site'].map((nm, i) => (
        <select key={nm} className="ph-in" aria-label={nm} value={f[i + 1]} disabled={!f[i] || f[0] === '~'} onChange={(e) => setLv(i + 1, e.target.value)}>
          <option value="">{nm}: all</option>
          {f[i] && f[0] !== '~' && opts(i + 1).map((o) => <option key={o}>{o}</option>)}
        </select>
      ))}
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
            {[['country', 'Country', 0], ['city', 'City', 1], ['site', 'Site', 2]].map(([k, nm, l]) => (
              <label key={k} style={{ flex: '1 1 140px' }}><span className="ph-lab">{nm}</span>
                <input className="ph-in" list={'ph-l-' + k} value={dp[k]} placeholder={nm === 'Site' ? 'Building or plant' : nm} onChange={(e) => upP({ [k]: e.target.value })} />
                {dl('ph-l-' + k, near(l))}
              </label>
            ))}
          </div>
          <label><span className="ph-lab">Address</span><input className="ph-in" value={dp.address} placeholder="Street, city" onChange={(e) => upP({ address: e.target.value })} /></label>
          <label><span className="ph-lab">Coordinates (latitude, longitude)</span>
            <input className="ph-in" value={ct ?? fmt(dp)} placeholder="Paste coordinates" onChange={(e) => setCt(e.target.value)} onBlur={() => { if (ct !== null) { parseCt(ct); setCt(null); } }} onKeyDown={(e) => { if (e.key === 'Enter') { parseCt(ct ?? ''); setCt(null); } }} /></label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="ph-btn" onClick={here}>Use my location</button>
            <button type="button" className="ph-btn" onClick={() => setMap(true)}>Pick on map</button>
            {dp.lat != null && <a className="ph-btn" href={'https://www.google.com/maps?q=' + dp.lat + ',' + dp.lng} target="_blank" rel="noreferrer">Open map</a>}
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
      {map && <MapPicker title={'Location of ' + sel} lat={dp.lat} lng={dp.lng} onSave={(p) => { upP({ lat: p.lat, lng: p.lng }); setCt(null); return true; }} onClose={() => setMap(false)} />}
    </>
  );
}
