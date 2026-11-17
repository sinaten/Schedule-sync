'use client';
import { useEffect, useState } from 'react';
import IssuePanel from './IssuePanel';
import WeatherTab from './WeatherTab';
import WeatherCapsules from './WeatherCapsules';
import ModelSlot from './ModelSlot';
import HseBar from './HseBar';
import { StatusChip, PriorityTag, AssigneeChip, FullBtn, fullBox, useWide } from './IssueList';

const BARS = ['Weather', 'Action Plan', 'Workflow', 'Location', 'HSE', 'Communication', 'Orders', 'Utility'];
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
const fsBody = (on, wide) => (on ? (wide ? { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' } : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }) : { display: 'contents' });
const fsTop = (on, wide) => (on ? (wide ? { display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: '1.5px solid #cdb893' } : { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', flex: '0.85 1 0', minHeight: 0, minWidth: 0 }) : { display: 'contents' });
const fsHalf = (on, wide, kind) => (on ? { flex: '1 1 0', minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', ...(!wide && kind === 'issue' ? { borderRight: '1.5px solid #cdb893' } : {}) } : {});
export default function FollowUp({ job }) {
  const [items, setItems] = useState([]);
  const [who, setWho] = useState({ me: '', can: false });
  const [open, setOpen] = useState({});
  const [adding, setAdding] = useState(null); // bar name
  const [text, setText] = useState('');
  const [aps, setAps] = useState([]); // the action plans this person may see
  const [, tick] = useState(0);
  const [top, setTop] = useState(0); // where the pinned bar header stops: just under the Issues / Follow-up tabs
  useEffect(() => {
    const f = () => { const t = document.querySelector('.ms-tabs-wrap'); if (!t) return; const cs = getComputedStyle(t); setTop((parseFloat(cs.top) || 0) + t.offsetHeight); };
    f(); const id = setTimeout(f, 400);
    window.addEventListener('resize', f);
    return () => { clearTimeout(id); window.removeEventListener('resize', f); };
  }, []);
  const [full, setFull] = useState(null);
  const wide = useWide();
  const [pan, setPan] = useState(null); // Comments / Files / Gallery of an issue or of its action plan
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
  const fresh = (bar) => bar === 'Action Plan' ? apFresh() : of(bar).filter((x) => new Date(x.created_at).getTime() > getSeen(job, bar)).length;
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
  // a count turns red when it is bigger than the last time it was touched; touching it marks it as read
  const cKey = (el, sc, k) => 'fu-cnt:' + job + ':' + el + ':' + sc + ':' + k;
  const cSeen = (el, sc, k) => { try { return Number(localStorage.getItem(cKey(el, sc, k))) || 0; } catch (e) { return 0; } };
  const unread = (el, sc, k, n) => (n || 0) > cSeen(el, sc, k);
  const closePan = async () => {
    const q = pan; setPan(null);
    if (q && q.sheet) {
      try { const j = await fetch('/api/issue?aps=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()); const a = (j.aps || []).find((x) => x.element_id === q.element); if (a) { const n = q.scope === 'ap' ? (q.sheet === 'files' ? a.files : a.photos) : (q.sheet === 'comments' ? a.i_comments : q.sheet === 'files' ? a.i_files : a.i_photos); localStorage.setItem(cKey(q.element, q.scope, q.sheet), String(n || 0)); } } catch (e) {}
    }
    tick((x) => x + 1); load();
  };
  const cnt = (el, sc, k, l, n, col) => { const u = unread(el, sc, k, n); return <button key={k} type="button" onClick={() => setPan({ element: el, scope: sc, sheet: k, seen: cSeen(el, sc, k) })} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontSize: 12.5, color: u ? '#c0392b' : '#141413', fontWeight: u ? 700 : 400, cursor: 'pointer' }}>{l} <b style={{ background: u ? '#c0392b' : n ? col : '#e7e3d8', color: u || n ? '#fff' : '#8a8576', borderRadius: 9, padding: '1px 7px', fontSize: 11.5, fontWeight: 600 }}>{n || 0}</b></button>; };
  return (
    <div className="ms-follow">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560, margin: '0 auto', padding: '8px 16px 24px' }}>
        {BARS.map((bar) => {
          if (bar === 'Weather') return <WeatherTab key={bar} job={job} asBar />;
          const o = !!open[bar], n = fresh(bar), list = of(bar);
          return (
            <div key={bar} style={{ border: '1px solid #e7e3d8', borderRadius: 14, background: '#fff' }}>
              <div role="button" tabIndex={0} aria-expanded={o} onClick={() => toggle(bar)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(bar); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', cursor: 'pointer', background: o ? '#f7f5ef' : '#fff', borderRadius: o ? '13px 13px 0 0' : 13, position: 'sticky', top, zIndex: 30, borderBottom: o ? '1px solid #efece3' : 0, WebkitTapHighlightColor: 'transparent' }}>
                <Bell n={n} />
                <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: '#141413' }}>{bar}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8710a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', transform: o ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
              </div>
              {o && (
                <div style={{ padding: '6px 12px 12px', borderTop: '1px solid #efece3' }}>
                  {bar === 'HSE' && <HseBar job={job} />}
                  {bar === 'Weather' && <WeatherTab job={job} bare />}
                  {bar === 'Action Plan' && aps.length === 0 && <div style={{ padding: '10px 2px', fontSize: 13, color: '#9a9686' }}>No action plans for you yet. A manager or an editor makes them from an issue.</div>}
                  {bar === 'Action Plan' && aps.map((a) => {
                    const as = Array.isArray(a.assignees) ? a.assignees : [];
                    return (
                      <div key={a.element_id} style={{ marginTop: 8, border: '1px solid #bfe0c8', borderRadius: 12, background: '#eef8f0', overflow: 'hidden', ...fullBox(full === a.element_id) }}>
                        <div style={{ padding: '9px 12px 6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                            <b style={{ fontSize: 18, letterSpacing: 0.2 }}>{a.card}</b>{isNew(a) && <span style={{ background: '#c0392b', color: '#fff', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>NEW</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                            {(isNew(a) || unread(a.element_id, 'issue', 'comments', a.i_comments) || unread(a.element_id, 'issue', 'files', a.i_files) || unread(a.element_id, 'issue', 'photos', a.i_photos) || unread(a.element_id, 'ap', 'files', a.files) || unread(a.element_id, 'ap', 'photos', a.photos)) && <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Changed" style={{ flex: 'none', order: 99 }}><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>}
                            <FullBtn on={full === a.element_id} toggle={() => setFull(full === a.element_id ? null : a.element_id)} /></div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'nowrap', minWidth: 0 }}>
                            <span style={{ fontSize: 12.5, color: '#2c7a47', fontWeight: 700, whiteSpace: 'nowrap' }}>{a.jobNo}</span>
                            <StatusChip st={a.status} onPick={(k) => apStatus(a, k)} locked={!who.can} />
                            <PriorityTag pr={a.priority} small />
                          </div>
                          <div style={{ marginTop: 7 }}><WeatherCapsules job={job} /></div>
                        </div>
                        <div style={fsBody(full === a.element_id, wide)}>
                        <div style={fsTop(full === a.element_id, wide)}>
                        <div style={{ ...fsHalf(full === a.element_id, wide, 'issue'), background: '#fbeedb', borderTop: '3px solid #e8710a', paddingTop: 6, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: '#a85a08' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#e8710a' }} />ISSUE</div>
                        <div style={{ padding: '4px 12px 6px', flex: full === a.element_id ? 1 : 'none', minHeight: 0, display: 'flex' }}><div style={{ flex: 1, minHeight: full === a.element_id ? 0 : 46, maxHeight: full === a.element_id ? 'none' : 120, overflowY: 'auto', borderRadius: 8, padding: '6px 9px', background: 'rgba(255,255,255,.65)', border: '1px solid #f0d3a8', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: a.description ? '#141413' : '#9a9686', fontStyle: a.description ? 'normal' : 'italic' }}>{a.description || 'No issue description yet'}</div></div>
                        <div style={{ padding: '2px 12px 8px', background: 'transparent', fontSize: 12.5, flex: 'none' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', ...(full === a.element_id ? { justifyContent: 'space-around', fontSize: 14, padding: '10px 0' } : {}) }}><span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, color: '#8a8576' }}>ISSUE</span>{[['comments', 'Comments', a.i_comments], ['files', 'Files', a.i_files], ['photos', 'Gallery', a.i_photos]].map(([k, l, n]) => cnt(a.element_id, 'issue', k, l, n, '#e8710a'))}</div>
                          {a.i_last && <div style={{ marginTop: 3, color: unread(a.element_id, 'issue', 'comments', a.i_comments) ? '#c0392b' : '#6b675c', fontSize: 12.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.i_last}</div>}
                        </div>
                        </div>
                        <div style={{ ...fsHalf(full === a.element_id, wide, 'ap'), background: '#dcf1e2', borderTop: '3px solid #2e9e5b', paddingTop: 6, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 4px', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: '#2c7a47' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#2e9e5b' }} />ACTION PLAN {'\u00B7'} HOW TO SOLVE IT</div>
                        {(a.start_date || a.end_date) && <div style={{ padding: '0 12px 6px', fontSize: 12.5, color: '#2c7a47', fontWeight: 600 }}>{'\u{1F4C5}'} {a.start_date ? new Date(a.start_date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '?'} {'\u2192'} {a.end_date ? new Date(a.end_date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '?'}</div>}
                        <div style={{ padding: '0 12px 8px', flex: full === a.element_id ? 1 : 'none', minHeight: 0, display: 'flex' }}><div style={{ flex: 1, minHeight: full === a.element_id ? 0 : 46, maxHeight: full === a.element_id ? 'none' : 140, overflowY: 'auto', borderRadius: 8, padding: '6px 9px', background: 'rgba(255,255,255,.65)', border: '1px solid #bfe0c8', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: a.body ? '#141413' : '#9a9686', fontStyle: a.body ? 'normal' : 'italic' }}>{a.body || 'No action plan text yet'}</div></div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 12px 8px' }}>{as.length ? as.map((x, i) => <AssigneeChip key={i} a={x} />) : <span style={{ fontSize: 12.5, color: '#9a9686' }}>Nobody assigned yet</span>}</div>
                        <div style={{ padding: '6px 12px 8px', borderTop: '1px solid #bfe0c8', background: 'transparent', flex: 'none' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center', fontSize: 12.5, ...(full === a.element_id ? { justifyContent: 'space-around', fontSize: 14, padding: '10px 0' } : {}) }}><span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, color: '#2c7a47' }}>ACTION PLAN</span>{[['files', 'Files', a.files], ['photos', 'Gallery', a.photos]].map(([k, l, n]) => cnt(a.element_id, 'ap', k, l, n, '#2e9e5b'))}<span style={{ flex: 1 }} /><span style={{ color: '#8a8576', fontSize: 11.5 }}>{a.updated_by || a.author || ''} {'\u00B7'} {when(a.updated_at)}</span></div>
                          {who.can && <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap', ...(full === a.element_id ? { justifyContent: 'space-around', padding: '6px 0' } : {}) }}>
                            <button type="button" onClick={() => setPan({ element: a.element_id, scope: 'ap', sheet: '', cam: true })} style={{ border: '1px solid #cfe9d6', background: '#fff', borderRadius: 14, padding: '4px 11px', font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{'\u{1F4F7}'} Add photos and videos</button>
                            <button type="button" onClick={() => setPan({ element: a.element_id, scope: 'ap', sheet: 'files' })} style={{ border: '1px solid #cfe9d6', background: '#fff', borderRadius: 14, padding: '4px 11px', font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{'\u{1F4CE}'} Add file</button>
                          </div>}
                        </div>
                        </div>
                        </div>
                        {full === a.element_id && <ModelSlot element={a.element_id} style={wide ? {} : { flex: '1.15 1 0' }} />}
                        </div>
                      </div>
                    );
                  })}
                  {bar !== 'Action Plan' && bar !== 'HSE' && bar !== 'Weather' && adding === bar && (
                    <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
                      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(bar); }} placeholder={'Add to ' + bar + '…'} style={{ flex: 1, minWidth: 0, height: 36, border: '1.5px solid #e0dccf', borderRadius: 18, padding: '0 14px', font: 'inherit', fontSize: 14, outline: 'none' }} />
                      <button type="button" onClick={() => add(bar)} disabled={!text.trim()} style={{ border: 0, borderRadius: 18, padding: '0 16px', background: text.trim() ? '#e8710a' : '#e7e3d8', color: '#fff', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default' }}>Add</button>
                    </div>
                  )}
                  {bar !== 'Action Plan' && bar !== 'HSE' && bar !== 'Weather' && list.length === 0 && adding !== bar && <div style={{ padding: '10px 2px', fontSize: 13, color: '#9a9686' }}>Nothing here yet.</div>}
                  {bar !== 'Action Plan' && bar !== 'HSE' && bar !== 'Weather' && list.map((x) => (
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
      {pan && (
        <div style={{ position: 'fixed', left: 0, top: -6000, width: '100vw', zIndex: 2500 }}>
          <IssuePanel key={pan.element + pan.sheet + (pan.cam ? 'c' : '') + (pan.scope || '')} job={job} element={pan.element} scope={pan.scope || 'issue'} initialSheet={pan.sheet} autoCam={!!pan.cam} onMsg={() => {}} seen={pan.seen} onClose={closePan} />
        </div>
      )}
    </div>
  );
}
