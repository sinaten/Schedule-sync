'use client';
import { useEffect, useState } from 'react';
import FollowUp from './FollowUp';

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
      {job && (<div className="ms-tabs-wrap"><div className="ms-tabs" role="tablist" aria-label="Inspection and follow-up">
        <button type="button" role="tab" aria-selected={tab === 'issues'} className={'ms-tab ms-tab-i' + (tab === 'issues' ? ' on' : '')} onClick={() => setTab('issues')}><i />Inspection</button>
        <button type="button" role="tab" aria-selected={tab === 'follow'} className={'ms-tab ms-tab-f' + (tab === 'follow' ? ' on' : '')} onClick={() => setTab('follow')}><i />Follow-up</button>
      </div></div>)}
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
        <button type="button" className="ms-qr ms-sina" aria-label="Open Sina" onClick={() => window.dispatchEvent(new Event('ss-guide'))} style={{ padding: 0, cursor: 'pointer' }}>
          <img className="sina-still" src="/sina-ai.png" alt="" width="100%" height="100%" draggable="false" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          <img className="sina-live" src="/sina-live.gif" alt="" width="100%" height="100%" draggable="false" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
        </button>
        <a className="ms-sm" href="/scan" aria-label="Scan QR code" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97757" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><path d="M14 14h2.5v2.5H14zM18 18h2.5M18 14h2.5v1" /></svg>
        </a>
        <button type="button" className="ms-sm" aria-label="Save changes" onClick={() => window.dispatchEvent(new Event('ss-save'))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', opacity: pending ? 1 : 0.4 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2e9e5b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
        </button>
      </nav>
    </>
  );
}
