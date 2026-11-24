'use client';
import { useEffect, useState } from 'react';
import { ST, Ic } from './OrdersBar';

// One shared look-up per job (kept 30 seconds): { element number: [{ id, status, eta }] }
const cache = {};
function getMap(job) {
  const c = cache[job];
  if (c && Date.now() - c.t < 30000) return c.p;
  const p = fetch('/api/orders?chips=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => j.map || {}).catch(() => ({}));
  cache[job] = { t: Date.now(), p };
  return p;
}
// The orders that were made for an element: one small bubble each (status icon, order number, status, arrival). Nothing is drawn when there are none.
export default function OrderChips({ job, element }) {
  const [l, setL] = useState([]);
  useEffect(() => { let on = true; getMap(job).then((m) => { if (on) setL(m[String(element)] || []); }); return () => { on = false; }; }, [job, element]);
  if (!l.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0' }}>
      {l.map((o) => {
        const s = ST[o.status] || ST.unknown;
        return <span key={o.id} title={'Order ' + String(o.id).padStart(4, '0')} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, background: s.bg, color: s.c, borderRadius: 12, padding: '3px 9px', fontSize: 12, whiteSpace: 'nowrap' }}><Ic d={s.ic} s={15} c={s.c} /><b style={{ fontWeight: 600 }}>{String(o.id).padStart(4, '0')}</b> {s.l}{o.eta ? ' \u00B7 ' + o.eta : ''}</span>;
      })}
    </div>
  );
}
