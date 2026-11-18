'use client';
import { useEffect, useState } from 'react';

// Home page: sites first. Country and City dropdowns plus one search box (site, project or job number).
// Desktop and tablet: the list sits in the middle; choosing a site slides it left and opens its projects on the right.
// Phone: one column, the projects open under the site.
const css = `
.hs .bar{display:flex;gap:8px;flex-wrap:wrap;margin:0 auto 14px;max-width:1100px}
.hs .bar input,.hs .bar select{flex:1 1 150px;min-width:0;padding:10px 12px;font-size:16px;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink)}
.hs .bar input{flex:2 1 240px}
.hs .cols{display:grid;grid-template-columns:minmax(0,1fr);max-width:1100px;margin:0 auto}
.hs.wide .cols{grid-template-columns:minmax(0,1fr) minmax(0,440px) minmax(0,0fr);transition:grid-template-columns .35s ease}
.hs.wide .cols.open{grid-template-columns:minmax(0,0fr) minmax(0,440px) minmax(0,1fr)}
.hs .cols>div{min-width:0}
.hs .rp{opacity:0;transition:opacity .3s ease .1s;padding-left:14px;overflow:hidden}
.hs .cols.open .rp{opacity:1}
.hs .card{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.hs .sh{display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;border:0;background:none;text-align:left;cursor:pointer;font:inherit;color:var(--ink)}
.hs .sh:hover{background:#f4f7f8}
.hs .sh.sel{background:#e3f1f2}
.hs .sub{font-size:13px;color:var(--mut)}
.hs .cnt{margin-left:auto;font-size:12px;color:var(--mut);background:#eef1f3;border-radius:999px;padding:2px 9px;white-space:nowrap}
.hs .site+.site{border-top:1px solid var(--line)}
.hs .proj{display:flex;align-items:center;gap:10px;padding:11px 14px;border-top:1px solid var(--line);text-decoration:none;color:var(--ink);flex-wrap:wrap}
.hs .proj:hover{background:#f4f7f8}
.hs .jn{font-weight:600;min-width:64px}
.hs .tag{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid #e3b4b9;color:#b00020;margin-left:auto}
.hs .rh{padding:12px 14px;font-weight:600}
.hs .empty{padding:24px 14px;text-align:center;color:var(--mut)}
.hs .chev{width:8px;height:8px;border-right:2px solid var(--mut);border-bottom:2px solid var(--mut);transform:rotate(-45deg);flex:0 0 auto}
.hs .chev.dn{transform:rotate(45deg)}.hs .chev.up{transform:rotate(-135deg)}
`;
export default function HomeSites({ sites }) {
  const [wide, setWide] = useState(false);
  const [q, setQ] = useState('');
  const [co, setCo] = useState('');
  const [ci, setCi] = useState('');
  const [sel, setSel] = useState('');
  const [op, setOp] = useState({});
  useEffect(() => {
    const m = window.matchMedia('(min-width: 760px)');
    const f = () => setWide(m.matches);
    f(); m.addEventListener('change', f);
    const s = new URLSearchParams(location.search).get('s');
    if (s) { setSel(s); setOp({ [s]: true }); }
    return () => m.removeEventListener('change', f);
  }, []);
  const pick = (id) => { try { history.replaceState(null, '', id ? '/?s=' + encodeURIComponent(id) : '/'); } catch (e) { /* ignore */ } };
  const countries = [...new Set(sites.map((s) => s.country).filter(Boolean))].sort();
  const cities = [...new Set(sites.filter((s) => !co || s.country === co).map((s) => s.city).filter(Boolean))].sort();
  const t = q.trim().toLowerCase();
  const shown = sites.map((s) => {
    if (s.id !== '' && ((co && s.country !== co) || (ci && s.city !== ci))) return null;
    if (s.id === '' && (co || ci)) return null;
    const siteHit = t && [s.name, s.city, s.country, s.address].join(' ').toLowerCase().includes(t);
    const jobs = s.jobs.filter((j) => !t || siteHit || (j.label + ' ' + (j.title || '')).toLowerCase().includes(t));
    if (t && !siteHit && !jobs.length) return null;
    if (s.id === '' && !jobs.length) return null;
    return { ...s, jobs };
  }).filter(Boolean);
  const cur = shown.find((s) => s.id === sel);
  const open = wide && !!cur;
  const click = (id) => {
    if (wide) { const n = sel === id ? '' : id; setSel(n); pick(n); }
    else { setOp((o) => ({ ...o, [id]: !o[id] })); }
  };
  const head = (s, isSel, chev) => (
    <button type="button" className={'sh' + (isSel ? ' sel' : '')} onClick={() => click(s.id)}>
      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{s.name}</span><br />
        <span className="sub">{s.id === '' ? 'Revit jobs not attached to a site yet' : [s.city, s.address].filter(Boolean).join(' · ') || 'No location yet'}</span>
      </span>
      <span className="cnt">{s.jobs.length} project{s.jobs.length === 1 ? '' : 's'}</span>
      <span className={'chev' + (chev ? ' ' + chev : '')} aria-hidden="true" />
    </button>
  );
  const rows = (s) => s.jobs.map((j) => (
    <a key={j.slug} className="proj" href={'/j/' + encodeURIComponent(j.slug)} style={j.state ? { opacity: 0.7 } : undefined}>
      <span className="jn">{j.label}</span>
      <span className="sub">{[j.title, j.n + ' schedule' + (j.n === 1 ? '' : 's'), j.model ? '3D model' : ''].filter(Boolean).join(' · ')}</span>
      {j.state && <span className="tag">{j.state === 'deleted' ? 'Deleted in Revit' : 'Inactive'}</span>}
    </a>
  ));
  return (
    <div className={'hs' + (wide ? ' wide' : '')}>
      <style>{css}</style>
      <div className="bar">
        <input type="search" aria-label="Search" placeholder="Search a site, project or job number" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Country" value={co} onChange={(e) => { setCo(e.target.value); setCi(''); }}>
          <option value="">All countries</option>{countries.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="City" value={ci} onChange={(e) => setCi(e.target.value)}>
          <option value="">All cities</option>{cities.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {!shown.length ? <p className="muted" style={{ textAlign: 'center' }}>{sites.length ? 'No match. Try another word.' : 'No jobs yet. Run the Revit add-in and choose the schedules to watch.'}</p> : (
        <div className={'cols' + (open ? ' open' : '')}>
          <div />
          <div className="card">
            {shown.map((s) => (
              <div className="site" key={s.id || '_none'}>
                {head(s, wide && s.id === sel, wide ? '' : (op[s.id] || t) ? 'up' : 'dn')}
                {!wide && (op[s.id] || t) ? rows(s) : null}
              </div>
            ))}
          </div>
          <div className="rp">
            {open && cur && <div className="card"><div className="rh">{cur.name}<span className="sub" style={{ fontWeight: 400 }}> {cur.city ? '· ' + cur.city : ''}</span></div>{cur.jobs.length ? rows(cur) : <div className="empty">No projects in this site yet.</div>}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
