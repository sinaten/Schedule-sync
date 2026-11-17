'use client';
import { useEffect, useState } from 'react';

// Admin > Data mapping. One folder per Revit job (named exactly like the job); its models and schedules sit inside.
export default function DataMapping() {
  const [f, setF] = useState(null);
  const [open, setOpen] = useState({});
  const [q, setQ] = useState('');
  const load = () => fetch('/api/admin/datamap').then((r) => r.json()).then((d) => setF(d.folders || [])).catch(() => setF([]));
  useEffect(() => { load(); }, []);
  const when = (t) => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString(); };
  const list = (f || []).filter((x) => !q || x.job.toLowerCase().includes(q.toLowerCase()) || (x.title || '').toLowerCase().includes(q.toLowerCase()));
  const chip = (x) => x.state === 'deleted' ? ['Deleted in Revit', '#b3261e'] : x.state === 'inactive' ? ['Inactive', '#8a6d00'] : ['Active', '#1b7a3a'];
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>Everything Revit sends lands here, in a folder named like the Revit job. Later syncs update the same folder. If something is deleted in Revit it is removed here too.</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search folders" style={{ maxWidth: 360, marginBottom: 12 }} />
      <button type="button" onClick={load} style={{ marginLeft: 8 }}>Refresh</button>
      {f === null && <div className="muted">Loading…</div>}
      {f && !list.length && <div className="muted">No folders yet. They appear when Revit syncs a project.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 760 }}>
        {list.map((x) => {
          const [c, col] = chip(x); const o = !!open[x.job];
          return (
            <div key={x.job} style={{ border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}>
              <button type="button" aria-expanded={o} onClick={() => setOpen({ ...open, [x.job]: !o })} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
                <b>{x.job}</b>
                {x.title ? <span className="muted">{x.title}</span> : null}
                <span style={{ marginLeft: 'auto', fontSize: 13, color: col, border: '1px solid ' + col, borderRadius: 999, padding: '1px 9px' }}>{c}</span>
              </button>
              {o && (
                <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="muted" style={{ fontSize: 14 }}>{x.site ? 'Site: ' + x.site : 'Not attached to a site yet (attach it in Projects).'}</div>
                  {x.state === 'deleted' && <div style={{ color: '#b3261e', fontSize: 14 }}>Deleted in Revit — its models and schedules were removed here.</div>}
                  <b style={{ fontSize: 14 }}>Models ({x.models.length})</b>
                  {x.models.map((m, i) => <div key={i} style={{ fontSize: 14 }}>{m.name} <span className="muted">{when(m.at)}</span></div>)}
                  {!x.models.length && <div className="muted" style={{ fontSize: 14 }}>None</div>}
                  <b style={{ fontSize: 14 }}>Schedules ({x.schedules.length})</b>
                  {x.schedules.map((s) => <div key={s.id} style={{ fontSize: 14 }}>{s.name} <span className="muted">{s.rows} rows · {when(s.at)}</span></div>)}
                  {!x.schedules.length && <div className="muted" style={{ fontSize: 14 }}>None</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ marginTop: 16, fontSize: 14 }}>Rules for how this data maps into projects will be set here later.</div>
    </>
  );
}
