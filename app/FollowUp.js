'use client';
import { useEffect, useState } from 'react';
import { StatusChip, PriorityTag, AssigneeChip } from './IssueList';

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
  const [aps, setAps] = useState([]); // the action plans this person may see
  const [, tick] = useState(0);
  const load = () => {
    fetch('/api/followup?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.items) { setItems(j.items); setWho({ me: j.me, can: !!j.can }); } }).catch(() => {});
    fetch('/api/issue?aps=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.aps) setAps(j.aps); }).catch(() => {});
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    window.addEventListener('focus', load);
    return () => { clearInterval(t); window.removeEventListener('focus', load); };
  }, [job]);
  const of = (bar) => items.filter((x) => x.bar === bar);
  // new = items from other people that came after the last time this bar was opened
  // new = a change by someone else (the action plan itself, or a comment, file or photo of its issue) after the last time the bar was opened
  const isNew = (a) => !!a.fresh_at && new Date(a.fresh_at).getTime() > getSeen(job, 'Action Plan');
  const apFresh = () => aps.filter(isNew).length;
  const fresh = (bar) => bar === 'Action Plan' ? apFresh() : of(bar).filter((x) => x.author !== who.me && new Date(x.created_at).getTime() > getSeen(job, bar)).length;
  const toggle = (bar) => {
    const o = !open[bar];
    setOpen((s) => ({ ...s, [bar]: o }));
    if (o) load(); // look again at the issues every time a bar is opened
    if (o) { const last = (bar === 'Action Plan' ? aps.map((a) => ({ created_at: a.fresh_at || a.updated_at })) : of(bar)).reduce((m, x) => Math.max(m, new Date(x.created_at).getTime()), 0); if (last) setSeen(job, bar, last); tick((n) => n + 1); }
  };
  const add = async (bar) => {
    const t = text.trim();
    if (!t) return;
    const r = await fetch('/api/followup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, bar, text: t }) });
    if (r.ok) { setText(''); setAdding(null); await load(); }
  };
  const apStatus = async (a, status) => {
    setAps((l) => l.map((x) => (x.element_id === a.element_id ? { ...x, status } : x)));
    await fetch('/api/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, element: a.element_id, action: 'ap-update', status }) });
    load();
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
                {bar !== 'Action Plan' && <button type="button" aria-label={'Add to ' + bar} onClick={(e) => { e.stopPropagation(); setOpen((s) => ({ ...s, [bar]: true })); setAdding(adding === bar ? null : bar); setText(''); }} style={{ width: 32, height: 32, borderRadius: 16, border: '1.5px solid #e8710a', background: adding === bar ? '#fff7ef' : '#fff', color: '#e8710a', fontSize: 22, lineHeight: '26px', padding: 0, cursor: 'pointer', flex: 'none' }}>+</button>}
                <span style={{ color: '#9a9686', fontSize: 12 }}>{o ? '▴' : '▾'}</span>
              </div>
              {o && (
                <div style={{ padding: '6px 12px 12px', borderTop: '1px solid #efece3' }}>
                  {bar === 'Action Plan' && aps.length === 0 && <div style={{ padding: '10px 2px', fontSize: 13, color: '#9a9686' }}>No action plans for you yet. A manager or an editor makes them from an issue.</div>}
                  {bar === 'Action Plan' && aps.map((a) => {
                    const as = Array.isArray(a.assignees) ? a.assignees : [];
                    return (
                      <div key={a.element_id} style={{ marginTop: 8, border: '1px solid #bfe0c8', borderRadius: 12, background: '#eef8f0', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexWrap: 'wrap' }}>
                          <b style={{ fontSize: 13.5 }}>{a.jobNo}</b>{isNew(a) && <span style={{ background: '#c0392b', color: '#fff', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>NEW</span>}
                          <StatusChip st={a.status} onPick={(k) => apStatus(a, k)} locked={!who.can} />
                          <PriorityTag pr={a.priority} />
                          <span style={{ flex: 1 }} />
                          <span style={{ fontSize: 11.5, color: '#8a8576' }}>from {a.card}</span>
                        </div>
                        <div style={{ padding: '0 12px 8px', fontSize: 13, lineHeight: 1.5, color: '#6b675c', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><b style={{ fontWeight: 600, color: '#8a8576', fontSize: 11, letterSpacing: 0.3 }}>ISSUE </b>{a.description || 'No description.'}</div>
                        <div style={{ padding: '0 12px 8px', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><b style={{ fontWeight: 600, color: '#a85a08', fontSize: 11, letterSpacing: 0.3 }}>HOW TO SOLVE IT </b>{a.body || <span style={{ color: '#9a9686' }}>Not written yet.</span>}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 12px 8px' }}>{as.length ? as.map((x, i) => <AssigneeChip key={i} a={x} />) : <span style={{ fontSize: 12.5, color: '#9a9686' }}>Nobody assigned yet</span>}</div>
                        <div style={{ padding: '6px 12px', borderTop: '1px solid #cfe9d6', background: '#f6fbf7', fontSize: 12.5 }}>
                          <div style={{ display: 'flex', gap: 14 }}><span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, color: '#8a8576' }}>ISSUE</span><span>Comments <b>{a.i_comments || 0}</b></span><span>Files <b>{a.i_files || 0}</b></span><span>Gallery <b>{a.i_photos || 0}</b></span></div>
                          {a.i_last && <div style={{ marginTop: 3, color: '#6b675c', fontSize: 12.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.i_last}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 14, padding: '6px 12px 8px', borderTop: '1px solid #cfe9d6', fontSize: 12.5, background: '#e1f3e6' }}><span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, color: '#2c7a47' }}>ACTION PLAN</span><span>Files <b>{a.files || 0}</b></span><span>Gallery <b>{a.photos || 0}</b></span><span style={{ flex: 1 }} /><span style={{ color: '#8a8576', fontSize: 11.5 }}>{a.updated_by || a.author || ''} {'\u00B7'} {when(a.updated_at)}</span></div>
                      </div>
                    );
                  })}
                  {bar !== 'Action Plan' && adding === bar && (
                    <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
                      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(bar); }} placeholder={'Add to ' + bar + '…'} style={{ flex: 1, minWidth: 0, height: 36, border: '1.5px solid #e0dccf', borderRadius: 18, padding: '0 14px', font: 'inherit', fontSize: 14, outline: 'none' }} />
                      <button type="button" onClick={() => add(bar)} disabled={!text.trim()} style={{ border: 0, borderRadius: 18, padding: '0 16px', background: text.trim() ? '#e8710a' : '#e7e3d8', color: '#fff', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default' }}>Add</button>
                    </div>
                  )}
                  {bar !== 'Action Plan' && list.length === 0 && adding !== bar && <div style={{ padding: '10px 2px', fontSize: 13, color: '#9a9686' }}>Nothing here yet. Press + to add.</div>}
                  {bar !== 'Action Plan' && list.map((x) => (
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
