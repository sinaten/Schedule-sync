'use client';
import { useEffect } from 'react';

// Admin only. Reads the labels of the buttons on the open page and tells the site, so a button the Tracking IDs catalog does not know shows up there as a "new thing found".
// Switch off: set SCAN to false.
const SCAN = true;
export default function IdScanner() {
  useEffect(() => {
    if (!SCAN) return undefined;
    let t = null; let seen = new Set();
    try { seen = new Set(JSON.parse(sessionStorage.getItem('idseen') || '[]')); } catch (e) {}
    const run = () => {
      try {
        const tab = (document.querySelector('.ms-tab.on') || {}).textContent || new URLSearchParams(location.search).get('tab') || '';
        const labs = new Set();
        document.querySelectorAll('button, [role="tab"], [role="button"], a.ms-sm, a.ms-qr').forEach((el) => {
          const l = String(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
          if (l && l.length > 1 && !/^[\d\W]+$/.test(l)) labs.add(l);
        });
        const fresh = [...labs].filter((l) => !seen.has(location.pathname.split('/').slice(0, 2).join('/') + '|' + tab + '|' + l));
        if (!fresh.length) return;
        fresh.forEach((l) => seen.add(location.pathname.split('/').slice(0, 2).join('/') + '|' + tab + '|' + l));
        try { sessionStorage.setItem('idseen', JSON.stringify([...seen].slice(-800))); } catch (e) {}
        fetch('/api/id-scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: location.pathname, tab, items: fresh.slice(0, 60) }) }).catch(() => {});
      } catch (e) {}
    };
    const later = () => { clearTimeout(t); t = setTimeout(run, 3000); };
    const mo = new MutationObserver(later);
    mo.observe(document.body, { childList: true, subtree: true });
    later();
    return () => { mo.disconnect(); clearTimeout(t); };
  }, []);
  return null;
}
