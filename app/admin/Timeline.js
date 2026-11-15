'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Viewer3D from '../Viewer3D';
import { computeColors } from '../../lib/colorrules';
import { fadeColor } from '../../lib/fade';

const inp = { padding: '6px 8px', fontSize: 14, border: '1px solid #cfd8dc', borderRadius: 6, background: '#fff' };
const btn = { padding: '7px 14px', fontSize: 14, fontWeight: 600, border: '1px solid #cfd8dc', borderRadius: 18, background: '#fff', cursor: 'pointer' };
const when = (t) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(t));
const day = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));

// Admin > Analysis > Timeline: replays the saved changes of one project like a film.
//   Mode "One person": only that person's changes play, the sentence beside the model names them.
//   Mode "Whole project": every change of every person, in the order it happened.
export default function Timeline() {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [job, setJob] = useState('');
  const [data, setData] = useState(null);
  const [look, setLook] = useState(null);
  const [msg, setMsg] = useState('');
  const [mode, setMode] = useState('all');
  const [user, setUser] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [step, setStep] = useState(0);     // how many events of the list are applied
  const [playing, setPlaying] = useState(false);
  const [gap, setGap] = useState(2);       // longest pause between two changes, seconds
  const [typed, setTyped] = useState('');
  const [fade, setFade] = useState(null);
  useEffect(() => { fetch('/api/fade', { cache: 'no-store' }).then((r) => r.json()).then((j) => setFade(j.settings)).catch(() => {}); }, []);

  useEffect(() => { if (!open || jobs.length) return; fetch('/api/admin/jobs', { cache: 'no-store' }).then((r) => r.json()).then((j) => { const l = (j.jobs || []).filter((x) => x.state !== 'deleted'); setJobs(l); if (l[0]) setJob(l[0].job); }).catch(() => {}); }, [open]);
  useEffect(() => {
    if (!open || !job) return;
    setData(null); setLook(null); setMsg('Loading…'); setStep(0); setPlaying(false); setUser(''); setFrom(''); setTo('');
    fetch('/api/admin/timeline?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.events) { setData(j); setMsg(j.events.length ? '' : 'No saved changes for this project yet.'); } else setMsg(j.error || 'Could not load.'); }).catch(() => setMsg('Could not load.'));
    fetch('/api/aps?look=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then(setLook).catch(() => {});
  }, [open, job]);

  const list = useMemo(() => {
    if (!data) return [];
    const a = from ? new Date(from + 'T00:00:00-05:00').getTime() : 0;
    const b = to ? new Date(to + 'T23:59:59-05:00').getTime() : Infinity;
    return data.events.filter((e) => e.t >= a && e.t <= b && (mode === 'all' || (user && e.user === user)));
  }, [data, mode, user, from, to]);
  useEffect(() => { setStep(0); setPlaying(false); }, [list]);

  // the values before the first change of the list: the 'from' of each part's first change; everything else stays as it is now
  const base = useMemo(() => {
    if (!data) return null;
    const m = new Map(data.rows.map((r) => [String(r.element_id), { ...r.vals }]));
    const seen = new Set();
    for (const e of list) { const k = e.element + '|' + e.param; if (seen.has(k)) continue; seen.add(k); const r = m.get(e.element) || { }; r[e.param] = e.from; m.set(e.element, r); }
    return m;
  }, [data, list]);

  // paint the model for the current step
  const paint = useRef(0);
  useEffect(() => {
    if (!base || !data || !data.rules || !look || !look.visible) return;
    const m = new Map([...base].map(([k, v]) => [k, { ...v }]));
    for (let i = 0; i < step && i < list.length; i++) { const e = list[i]; const r = m.get(e.element) || {}; r[e.param] = e.to; m.set(e.element, r); }
    const cols = computeColors(data.rules, [...m].map(([element_id, vals]) => ({ element_id, vals })));
    const fin = {};
    const mat = {};
    for (const hx in look.matColors || {}) look.matColors[hx].forEach((i) => { mat[i] = hx; });
    look.visible.forEach((i) => { fin[i] = fadeColor(mat[i] || null, fade); });
    for (const hx in cols) cols[hx].forEach((i) => { fin[i] = hx; });
    const id = ++paint.current;
    const go = () => { if (id === paint.current) window.dispatchEvent(new CustomEvent('ss-paint', { detail: { fin } })); };
    go(); const t1 = setTimeout(go, 600); const t2 = setTimeout(go, 2000); // the model may still be loading
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [base, step, list, data, look, fade]);

  // play: next change after a pause that follows the real gap, but never longer than "gap" seconds
  useEffect(() => {
    if (!playing) return;
    if (step >= list.length) { setPlaying(false); return; }
    const prev = step > 0 ? list[step - 1].t : list[0].t;
    const real = Math.max(0, list[step].t - prev) / 60000;
    const ms = step === 0 ? 400 : Math.min(gap * 1000, 500 + real * 100);
    const t = setTimeout(() => setStep((s) => s + 1), ms);
    return () => clearTimeout(t);
  }, [playing, step, list, gap]);

  // the sentence beside the model is typed letter by letter
  const cur = step > 0 ? list[step - 1] : null;
  const sentence = cur ? cur.user + ' · ' + when(cur.t) + (cur.lat != null && cur.lng != null ? ' · ' + Number(cur.lat).toFixed(4) + ', ' + Number(cur.lng).toFixed(4) : ' · no location') + '\npart ' + cur.element + ': ' + cur.param + '  ' + (cur.from ? 'Yes' : 'No') + ' → ' + (cur.to ? 'Yes' : 'No') : '';
  useEffect(() => {
    setTyped('');
    if (!sentence) return;
    let n = 0;
    const t = setInterval(() => { n += 2; setTyped(sentence.slice(0, n)); if (n >= sentence.length) clearInterval(t); }, 18);
    return () => clearInterval(t);
  }, [sentence]);

  return (
    <div style={{ marginTop: 22, border: '1px solid #d6dde1', borderRadius: 12, background: '#fff' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '14px 16px', fontSize: 16, fontWeight: 700, border: 0, background: 'transparent', cursor: 'pointer' }}>
        <span>Timeline</span><span style={{ color: '#8a979d' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <select value={job} onChange={(e) => setJob(e.target.value)} style={inp}>{jobs.map((j) => <option key={j.job} value={j.job}>{j.job}</option>)}</select>
            <select value={mode} onChange={(e) => setMode(e.target.value)} style={inp}><option value="all">Whole project</option><option value="user">One person</option></select>
            {mode === 'user' && <select value={user} onChange={(e) => setUser(e.target.value)} style={inp}><option value="">Choose a person…</option>{(data?.users || []).map((u) => <option key={u} value={u}>{u}</option>)}</select>}
            <label style={{ fontSize: 13 }}>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inp} /></label>
            <label style={{ fontSize: 13 }}>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inp} /></label>
            <label style={{ fontSize: 13 }}>Pause up to <select value={gap} onChange={(e) => setGap(+e.target.value)} style={inp}><option value="1">1 s</option><option value="2">2 s</option><option value="3">3 s</option></select></label>
          </div>
          {msg && <p style={{ fontSize: 13, color: '#546e7a' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <button type="button" style={btn} onClick={() => { setPlaying(false); setStep(0); }}>⏮</button>
            <button type="button" style={btn} onClick={() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }}>◀ Back</button>
            <button type="button" style={{ ...btn, background: '#16262e', color: '#fff' }} onClick={() => { if (step >= list.length) setStep(0); setPlaying((p) => !p); }} disabled={!list.length}>{playing ? '⏸ Pause' : '▶ Play'}</button>
            <button type="button" style={btn} onClick={() => { setPlaying(false); setStep((s) => Math.min(list.length, s + 1)); }}>Next ▶</button>
            <button type="button" style={btn} onClick={() => { setPlaying(false); setStep(list.length); }}>⏭</button>
            <span style={{ fontSize: 13, color: '#546e7a' }}>{step} / {list.length}{cur ? ' · ' + day(cur.t) : ''}</span>
          </div>
          <input type="range" min="0" max={list.length} value={step} onChange={(e) => { setPlaying(false); setStep(+e.target.value); }} style={{ width: '100%', marginBottom: 10 }} disabled={!list.length} />
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '2 1 420px', minWidth: 300 }}><Viewer3D key={job} job={job} /></div>
            <div style={{ flex: '1 1 220px', minWidth: 200 }}>
              <pre style={{ margin: 0, minHeight: 90, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 13, lineHeight: 1.5, background: '#16262e', color: '#d8f2e0', padding: 12, borderRadius: 10 }}>{typed || (list.length ? 'Press Play.' : '')}{typed ? '▌' : ''}</pre>
              <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 10, fontSize: 12, color: '#455a64' }}>
                {list.slice(0, step).reverse().slice(0, 40).map((e, i) => (<div key={step - i} style={{ padding: '4px 0', borderBottom: '1px solid #eef1f3' }}><b>{e.user}</b> · {when(e.t)}<br />{e.element}: {e.param} {e.from ? 'Yes' : 'No'} → {e.to ? 'Yes' : 'No'}</div>))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
