'use client';
import { useEffect, useState } from 'react';
import FollowUp from './FollowUp';
// true = the gallery picture sits on the big middle button and the QR picture on the small one (sizes, places and links unchanged). false = back to the old pictures.
const ICON_SWAP = true;

// Phone-only chrome (hidden by CSS on laptops): back / home / avatar on top, QR button at the bottom.
function initials(n) {
  const p = String(n || '').trim().split(/[\s._-]+/).filter(Boolean);
  return (p.length > 1 ? p[0][0] + p[1][0] : (p[0] || '?')[0]).toUpperCase();
}

// Remembers where the person was while the browser stays open (localStorage): the tab of a job, the last job page (for the way back from Admin) and the scroll place of a page.
const ss = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

export default function MobileShell({ name, role, admin }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('follow');
  const [pending, setPending] = useState(0);
  const [job, setJob] = useState('');
  const guest = false; // My Work tab removed for now (code kept in MyWork.js)
  // the page below the tabs follows the choice: Issues shows the normal job page (model), Follow-up is empty for now and is the default
  useEffect(() => { if (job) ss.set('ms-tab:' + job, tab); }, [tab, job]);
  useEffect(() => {
    if (job) document.body.setAttribute('data-ms-tab', tab); else document.body.removeAttribute('data-ms-tab');
    // the model viewer cannot size itself while its page is hidden: tell it to re-measure when the tab changes
    const t1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 60), t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [tab, job]);
  const [online, setOnline] = useState(null);
  const [siteOk, setSiteOk] = useState(null);          // can this page reach the website?
  const canR = role === 'admin' || role === 'editor'; // only managers and editors may ask Revit for a refresh
  const rCol = !canR ? '#b5b8bb' : online === false ? '#d64545' : '#2f7dd1'; // grey = not allowed, red = Revit is not connected, blue = connected
  const [phase, setPhase] = useState('idle');
  const [pct, setPct] = useState(0);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 6000); };
  useEffect(() => {
    if (job) document.body.setAttribute('data-ms-job', '1'); else document.body.removeAttribute('data-ms-job');
    return () => document.body.removeAttribute('data-ms-job');
  }, [job]);
  useEffect(() => {
    const m = location.pathname.match(/^\/j\/([^/]+)/);
    if (m) {
      const j = decodeURIComponent(m[1]);
      setJob(j);
      const saved = ss.get('ms-tab:' + j);
      if (saved === 'issues' || saved === 'follow') setTab(saved);
      else if (!window.matchMedia('(pointer:coarse) and (max-width:1024px)').matches) setTab('issues'); // on a laptop the model page (Issues) is the one shown first
      ss.set('ms-last', location.pathname + location.search); // where "back" from Admin must return to
    }
  }, []);
  useEffect(() => {
    if (!job) return;
    let dead = false;
    const check = () => fetch('/api/refresh-model?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (dead) return; setSiteOk(true); if (typeof j.online === 'boolean') setOnline(j.online); }).catch(() => { if (!dead) setSiteOk(false); });
    check();
    const t = setInterval(check, 20000);
    return () => { dead = true; clearInterval(t); };
  }, [job]);
  useEffect(() => {
    if (phase !== 'running') return;
    const t0 = Date.now();
    const t = setInterval(async () => {
      try {
        const j = await fetch('/api/refresh-model?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json());
        if (typeof j.pct === 'number') setPct(j.pct);
        if (j.state === 'done') {
          setPct(100);
          setPhase('done');
          // colours only: the open model is recoloured in place; a full publish needs a fresh page
          if (j.mode === 'quick') { window.dispatchEvent(new Event('ss-reload-look')); setTimeout(() => setPhase('idle'), 2500); }
          else setTimeout(() => location.reload(), 3000);
          return;
        }
        if (j.state === 'error') { setPhase('idle'); flash(j.msg || 'Revit could not publish the model.'); return; }
      } catch (e) {}
      if (Date.now() - t0 > 8 * 60 * 1000) { setPhase('idle'); flash('Revit did not answer. Check that it is open.'); }
    }, 4000);
    return () => clearInterval(t);
  }, [phase, job]);
  async function refreshModel() {
    if (!job || !canR || phase !== 'idle') return;
    try {
      const r = await fetch('/api/refresh-model', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, source: window.__ssMode === 'source' }) });
      const j = await r.json().catch(() => ({}));
      if (j.offline) { setOnline(false); flash('Turn on your laptop and open Revit, then try again.'); return; }
      if (!r.ok) { flash(j.error || 'Could not start the refresh.'); return; }
      setOnline(true);
      setPct(0);
      setPhase('running');
    } catch (e) { flash('No connection to the website.'); }
  }
  useEffect(() => {
    const f = (e) => setPending(Number(e.detail) || 0);
    window.addEventListener('ss-draft', f);
    return () => window.removeEventListener('ss-draft', f);
  }, []);
  // scroll place of every page: saved while scrolling, put back after a refresh or when coming back to it
  useEffect(() => {
    const key = 'ms-scroll:' + location.pathname;
    let tm = null;
    const save = () => { clearTimeout(tm); tm = setTimeout(() => ss.set(key, String(window.scrollY || 0)), 150); };
    window.addEventListener('scroll', save, { passive: true });
    let nav = ''; try { nav = (performance.getEntriesByType('navigation')[0] || {}).type || ''; } catch (e) {}
    const y = Number(ss.get(key));
    let t0 = null;
    if (y > 0 && (nav === 'reload' || nav === 'back_forward' || ss.get('ms-return') === location.pathname)) {
      let n = 0; // the page fills in a moment after it opens: try for about 3 seconds
      t0 = setInterval(() => { window.scrollTo(0, y); if (Math.abs((window.scrollY || 0) - y) < 4 || ++n > 15) clearInterval(t0); }, 200);
    }
    return () => { window.removeEventListener('scroll', save); clearTimeout(tm); if (t0) clearInterval(t0); };
  }, []);
  // a fresh start of the app on the first page: open the last job page again (only once per start, so the Home button still works)
  useEffect(() => {
    let started = false; try { started = !!sessionStorage.getItem('ms-started'); sessionStorage.setItem('ms-started', '1'); } catch (e) {}
    const last = ss.get('ms-last');
    if (!started && location.pathname === '/' && !location.search && last && /^\/j\//.test(last)) { ss.set('ms-return', last.split('?')[0]); location.replace(last); }
  }, []);
  const back = () => { const last = ss.get('ms-last'); if (/^\/admin/.test(location.pathname) && last) { ss.set('ms-return', last.split('?')[0]); location.href = last; return; } if (history.length > 1) history.back(); else location.href = '/'; };
  return (
    <>
      <header className="ms-top">
        <button type="button" className="ms-btn" aria-label="Back" onClick={back}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141413" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="ms-right">
          <a className="ms-btn" href="/" aria-label="Home">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#141413" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></svg>
          </a>
          <button type="button" className="ms-btn ms-av" aria-label="Profile and settings" aria-expanded={open} onClick={() => setOpen(!open)}>{initials(name)}</button>
        </div>
        {open && (
          <>
            <div className="ms-scrim" onClick={() => setOpen(false)} />
            <div className="ms-pop">
              <div className="ms-who"><b>{name}</b><span>{role}</span></div>
              <div className="ms-sep" />
              {admin && <a href="/admin">Admin</a>}
              <a href="/" onClick={() => setOpen(false)}>Jobs</a>
              <div className="ms-sep" />
              <a href="/api/logout" className="ms-out">Sign out</a>
            </div>
          </>
        )}
      </header>
      {job && (<div className="ms-tabs-wrap"><div className="ms-tabs" role="tablist" aria-label="Inspection, follow-up and my work">
        {!guest && <button type="button" role="tab" aria-selected={tab === 'follow'} className={'ms-tab ms-tab-f' + (tab === 'follow' ? ' on' : '')} onClick={() => setTab('follow')}><i />Follow-up</button>}
        {!guest && <button type="button" role="tab" aria-selected={tab === 'issues'} className={'ms-tab ms-tab-i' + (tab === 'issues' ? ' on' : '')} onClick={() => setTab('issues')}><i />Inspection</button>}
      </div>
      <div className="ms-strip">{tab === 'follow' ? 'Plans, orders, safety and more' : 'Walk the model, tick stages'}</div></div>)}
      <div className="ms-spacer" />
      {job && <FollowUp job={job} />}
      <nav className={'ms-bot' + (job ? ' ms-job' : '')} aria-label="Quick actions">
        <button type="button" className="ms-sm" aria-label="Refresh this page from the website" onClick={() => location.reload()} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', opacity: job ? 1 : 0.4 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={siteOk === false ? '#d64545' : '#2e9e5b'} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><g><path d="M1.66 8.24A11.0 11.0 0 0 1 21.01 5.69" /><path d="M21.27 2.70L21.01 5.69L18.11 4.91" /><path d="M22.34 15.76A11.0 11.0 0 0 1 2.99 18.31" /><path d="M2.73 21.30L2.99 18.31L5.89 19.09" /></g><path d="M6.4 11.8L12 6.2l5.6 5.6M7.8 11v6.6h8.4V11" /></svg>
        </button>
        {toast && <div className="ms-toast">{toast}</div>}
        <button type="button" className="ms-sm" aria-label="Refresh the model from Revit" disabled={!canR || !job} onClick={refreshModel} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: canR && job ? 'pointer' : 'default', opacity: job ? 1 : 0.4 }}>
          {phase === 'idle' ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={rCol} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><g><path d="M1.66 8.24A11.0 11.0 0 0 1 21.01 5.69" /><path d="M21.27 2.70L21.01 5.69L18.11 4.91" /><path d="M22.34 15.76A11.0 11.0 0 0 1 2.99 18.31" /><path d="M2.73 21.30L2.99 18.31L5.89 19.09" /></g><text x="12" y="15.6" textAnchor="middle" fontSize="10.5" fontWeight="800" fill={rCol} stroke="none" fontFamily="inherit">R</text></svg>
          ) : (
            <>
              <svg width="42" height="42" viewBox="0 0 42 42" style={{ position: 'absolute', inset: 0 }} aria-hidden="true"><circle cx="21" cy="21" r="19" fill="none" stroke="#dbe8f7" strokeWidth="2.5" /><circle cx="21" cy="21" r="19" fill="none" stroke="#2f7dd1" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={(2 * Math.PI * 19 * Math.max(0, Math.min(100, pct))) / 100 + ' ' + 2 * Math.PI * 19} transform="rotate(-90 21 21)" /></svg>
              <span style={{ position: 'relative', fontSize: 12, fontWeight: 700, color: '#2f7dd1', lineHeight: 1 }}>{Math.round(pct)}</span>
            </>
          )}
        </button>
        <a className="ms-qr" href="/scan" aria-label="Scan QR code">
          {ICON_SWAP ? (
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#D97757" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.7" /><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" /></svg>
          ) : (
          <svg width="46" height="46" viewBox="-1 -1 23 23" fill="#D97757" shapeRendering="crispEdges" aria-hidden="true"><path d="M0 0h7v1h-7zM8 0h2v1h-2zM11 0h1v1h-1zM14 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h2v1h-2zM11 1h2v1h-2zM14 1h1v1h-1zM20 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h3v1h-3zM12 2h1v1h-1zM14 2h1v1h-1zM16 2h3v1h-3zM20 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h1v1h-1zM12 3h1v1h-1zM14 3h1v1h-1zM16 3h3v1h-3zM20 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM9 4h1v1h-1zM11 4h2v1h-2zM14 4h1v1h-1zM16 4h3v1h-3zM20 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h2v1h-2zM11 5h1v1h-1zM14 5h1v1h-1zM20 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h7v1h-7zM9 7h1v1h-1zM11 7h2v1h-2zM0 8h1v1h-1zM2 8h2v1h-2zM5 8h3v1h-3zM10 8h1v1h-1zM15 8h1v1h-1zM17 8h2v1h-2zM20 8h1v1h-1zM0 9h2v1h-2zM7 9h1v1h-1zM11 9h1v1h-1zM14 9h1v1h-1zM16 9h1v1h-1zM0 10h2v1h-2zM3 10h6v1h-6zM10 10h3v1h-3zM14 10h2v1h-2zM20 10h1v1h-1zM0 11h2v1h-2zM4 11h2v1h-2zM7 11h3v1h-3zM11 11h4v1h-4zM0 12h1v1h-1zM5 12h4v1h-4zM10 12h11v1h-11zM10 13h3v1h-3zM16 13h5v1h-5zM0 14h7v1h-7zM8 14h2v1h-2zM11 14h2v1h-2zM14 14h1v1h-1zM16 14h2v1h-2zM0 15h1v1h-1zM6 15h1v1h-1zM9 15h4v1h-4zM16 15h1v1h-1zM0 16h1v1h-1zM2 16h3v1h-3zM6 16h1v1h-1zM10 16h1v1h-1zM12 16h5v1h-5zM19 16h1v1h-1zM0 17h1v1h-1zM2 17h3v1h-3zM6 17h1v1h-1zM10 17h5v1h-5zM18 17h1v1h-1zM0 18h1v1h-1zM2 18h3v1h-3zM6 18h1v1h-1zM8 18h1v1h-1zM13 18h2v1h-2zM16 18h1v1h-1zM19 18h2v1h-2zM0 19h1v1h-1zM6 19h1v1h-1zM10 19h3v1h-3zM15 19h1v1h-1zM19 19h1v1h-1zM0 20h7v1h-7zM8 20h2v1h-2zM14 20h1v1h-1zM17 20h4v1h-4z" /></svg>
          )}
        </a>
        <a className="ms-sm" href="/media" aria-label="Photos and videos" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {ICON_SWAP ? (
          <svg width="22" height="22" viewBox="-1 -1 23 23" fill="#D97757" shapeRendering="crispEdges" aria-hidden="true"><path d="M0 0h7v1h-7zM8 0h2v1h-2zM11 0h1v1h-1zM14 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h2v1h-2zM11 1h2v1h-2zM14 1h1v1h-1zM20 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h3v1h-3zM12 2h1v1h-1zM14 2h1v1h-1zM16 2h3v1h-3zM20 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h1v1h-1zM12 3h1v1h-1zM14 3h1v1h-1zM16 3h3v1h-3zM20 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM9 4h1v1h-1zM11 4h2v1h-2zM14 4h1v1h-1zM16 4h3v1h-3zM20 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h2v1h-2zM11 5h1v1h-1zM14 5h1v1h-1zM20 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h7v1h-7zM9 7h1v1h-1zM11 7h2v1h-2zM0 8h1v1h-1zM2 8h2v1h-2zM5 8h3v1h-3zM10 8h1v1h-1zM15 8h1v1h-1zM17 8h2v1h-2zM20 8h1v1h-1zM0 9h2v1h-2zM7 9h1v1h-1zM11 9h1v1h-1zM14 9h1v1h-1zM16 9h1v1h-1zM0 10h2v1h-2zM3 10h6v1h-6zM10 10h3v1h-3zM14 10h2v1h-2zM20 10h1v1h-1zM0 11h2v1h-2zM4 11h2v1h-2zM7 11h3v1h-3zM11 11h4v1h-4zM0 12h1v1h-1zM5 12h4v1h-4zM10 12h11v1h-11zM10 13h3v1h-3zM16 13h5v1h-5zM0 14h7v1h-7zM8 14h2v1h-2zM11 14h2v1h-2zM14 14h1v1h-1zM16 14h2v1h-2zM0 15h1v1h-1zM6 15h1v1h-1zM9 15h4v1h-4zM16 15h1v1h-1zM0 16h1v1h-1zM2 16h3v1h-3zM6 16h1v1h-1zM10 16h1v1h-1zM12 16h5v1h-5zM19 16h1v1h-1zM0 17h1v1h-1zM2 17h3v1h-3zM6 17h1v1h-1zM10 17h5v1h-5zM18 17h1v1h-1zM0 18h1v1h-1zM2 18h3v1h-3zM6 18h1v1h-1zM8 18h1v1h-1zM13 18h2v1h-2zM16 18h1v1h-1zM19 18h2v1h-2zM0 19h1v1h-1zM6 19h1v1h-1zM10 19h3v1h-3zM15 19h1v1h-1zM19 19h1v1h-1zM0 20h7v1h-7zM8 20h2v1h-2zM14 20h1v1h-1zM17 20h4v1h-4z" /></svg>
          ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97757" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.7" /><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" /></svg>
          )}
        </a>
        <button type="button" className="ms-sm" aria-label="Save changes" onClick={() => window.dispatchEvent(new Event('ss-save'))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', opacity: pending ? 1 : 0.4 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2e9e5b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
        </button>
      </nav>
    </>
  );
}
