'use client';
import { useEffect, useState } from 'react';

const BARS = ['Action Plan', 'Workflow', 'Location', 'HSE', 'Communication', 'Orders', 'Utility'];
const seenKey = (job, bar) => 'fu-seen:' + job + ':' + bar;
const getSeen = (job, bar) => { try { return Number(localStorage.getItem(seenKey(job, bar))) || 0; } catch (e) { return 0; } };
const setSeen = (job, bar, t) => { try { localStorage.setItem(seenKey(job, bar), String(t)); } catch (e) {} };
const when = (t) => { const d = new Date(t); return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };

function Bell({ n }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={n ? '#e8710a' : '#9a9686'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>
      {n > 0 && <b style={{ position: 'absolute', top: -2, right: -4, minWidth: 17, height: 17, borderRadius: 9, background: '#c0392b', color: '#fff', fontSize: 11, fontWeight: 600, lineHeight: '17px', textAlign: 'center', padding: '0 4px', boxSizing: 'border-box' }}>{n}</b>}
    </span>
  );
}

// The Follow-up page: seven horizontal bars; a bell with the number of new items from others, the name, a + to add; touching a bar opens it like a drawer.
export default function FollowUp({ job }) {
  const [items, setItems] = useState([]);
  const [who, setWho] = useState({ me: '', can: false });
  const [open, setOpen] = useState({});
  const [adding, setAdding] = useState(null); // bar name
  const [text, setText] = useState('');
  const [, tick] = useState(0);
  const load = () => fetch('/api/followup?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.items) { setItems(j.items); setWho({ me: j.me, can: !!j.can }); } }).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    window.addEventListener('focus', load);
    return () => { clearInterval(t); window.removeEventListener('focus', load); };
  }, [job]);
  const of = (bar) => items.filter((x) => x.bar === bar);
  // new = items from other people that came after the last time this bar was opened
  const fresh = (bar) => of(bar).filter((x) => x.author !== who.me && new Date(x.created_at).getTime() > getSeen(job, bar)).length;
  const toggle = (bar) => {
    const o = !open[bar];
    setOpen((s) => ({ ...s, [bar]: o }));
    if (o) { const last = of(bar).reduce((m, x) => Math.max(m, new Date(x.created_at).getTime()), 0); if (last) setSeen(job, bar, last); tick((n) => n + 1); }
  };
  const add = async (bar) => {
    const t = text.trim();
    if (!t) return;
    const r = await fetch('/api/followup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, bar, text: t }) });
    if (r.ok) { setText(''); setAdding(null); await load(); }
  };
  const remove = async (x) => {
    setItems((l) => l.filter((y) => y.id !== x.id));
    const r = await fetch('/api/followup?job=' + encodeURIComponent(job) + '&id=' + x.id, { method: 'DELETE' });
    if (!r.ok) load();
  };
  return (
    <div className="ms-follow">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560, margin: '0 auto', padding: '8px 16px 24px' }}>
        {BARS.map((bar) => {
          const o = !!open[bar], n = fresh(bar), list = of(bar);
          return (
            <div key={bar} style={{ border: '1px solid #e7e3d8', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
              <div role="button" tabIndex={0} aria-expanded={o} onClick={() => toggle(bar)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(bar); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', cursor: 'pointer', background: o ? '#f7f5ef' : '#fff', WebkitTapHighlightColor: 'transparent' }}>
                <Bell n={n} />
                <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: '#141413' }}>{bar}</span>
                <button type="button" aria-label={'Add to ' + bar} onClick={(e) => { e.stopPropagation(); setOpen((s) => ({ ...s, [bar]: true })); setAdding(adding === bar ? null : bar); setText(''); }} style={{ width: 32, height: 32, borderRadius: 16, border: '1.5px solid #e8710a', background: adding === bar ? '#fff7ef' : '#fff', color: '#e8710a', fontSize: 22, lineHeight: '26px', padding: 0, cursor: 'pointer', flex: 'none' }}>+</button>
                <span style={{ color: '#9a9686', fontSize: 12 }}>{o ? '▴' : '▾'}</span>
              </div>
              {o && (
                <div style={{ padding: '6px 12px 12px', borderTop: '1px solid #efece3' }}>
                  {adding === bar && (
                    <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
                      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(bar); }} placeholder={'Add to ' + bar + '…'} style={{ flex: 1, minWidth: 0, height: 36, border: '1.5px solid #e0dccf', borderRadius: 18, padding: '0 14px', font: 'inherit', fontSize: 14, outline: 'none' }} />
                      <button type="button" onClick={() => add(bar)} disabled={!text.trim()} style={{ border: 0, borderRadius: 18, padding: '0 16px', background: text.trim() ? '#e8710a' : '#e7e3d8', color: '#fff', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default' }}>Add</button>
                    </div>
                  )}
                  {list.length === 0 && adding !== bar && <div style={{ padding: '10px 2px', fontSize: 13, color: '#9a9686' }}>Nothing here yet. Press + to add.</div>}
                  {list.map((x) => (
                    <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 10px', marginTop: 6, borderRadius: 10, background: '#f7f5ef' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#141413' }}>{x.body}</div>
                        <div style={{ fontSize: 11.5, color: '#8a8576', marginTop: 2 }}>{x.author || ''} {'·'} {when(x.created_at)}</div>
                      </div>
                      {(who.can || !x.author || x.author === who.me) && <button type="button" aria-label="Remove" onClick={() => remove(x)} style={{ border: 0, background: 'none', color: '#9a9686', fontSize: 15, cursor: 'pointer', padding: 2 }}>{'✕'}</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
