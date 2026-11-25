'use client';
import { useEffect, useState } from 'react';

// Diagnostic strip, only when the address has ?debug=1. It only reads and counts (nothing is changed or saved on the site):
// how many times this page was loaded in this tab, what the 3D viewer did (starts, colour re-applies), and every request that failed.
export default function DebugBar() {
  const [on, setOn] = useState(false);
  const [t, setT] = useState('');
  useEffect(() => {
    let q = false; try { q = /[?&]debug=1/.test(location.search); } catch (e) { /* ignore */ }
    if (!q) return;
    setOn(true);
    let loads = 1; try { loads = (parseInt(sessionStorage.getItem('dbg-loads') || '0', 10) || 0) + 1; sessionStorage.setItem('dbg-loads', String(loads)); } catch (e) { /* ignore */ }
    const t0 = Date.now(), bad = [], n = {};
    const of = window.fetch;
    window.fetch = function (...a) {
      const u = String((a[0] && a[0].url) || a[0] || '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      n[u] = (n[u] || 0) + 1;
      return of.apply(this, a).then((r) => { if (!r.ok) bad.push(Math.round((Date.now() - t0) / 1000) + 's ' + r.status + ' ' + u); return r; });
    };
    const f = () => {
      const d = window.__ssDbg || {};
      const top = Object.entries(n).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => v + 'x ' + k).join('\n');
      setT('loads in this tab: ' + loads + '   seconds: ' + Math.round((Date.now() - t0) / 1000) + '\nviewer: ' + Object.entries(d).filter(([k]) => k !== 'last').map(([k, v]) => k + '=' + v).join('  ') + '  last=' + (d.last || '-') + '\nfailed: ' + (bad.length ? bad.slice(-5).join(' | ') : 'none') + '\nrequests:\n' + top);
    };
    f();
    const id = setInterval(f, 1000);
    return () => { clearInterval(id); window.fetch = of; };
  }, []);
  if (!on) return null;
  return <pre style={{ position: 'fixed', left: 6, right: 6, bottom: 6, zIndex: 2147483000, margin: 0, padding: '6px 8px', background: 'rgba(20,20,19,.88)', color: '#fff', font: '11px/1.35 ui-monospace,monospace', borderRadius: 8, whiteSpace: 'pre-wrap', maxHeight: '45vh', overflow: 'auto', pointerEvents: 'none' }}>{t}</pre>;
}
