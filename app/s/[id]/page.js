'use client';
import { useEffect, useState, useCallback } from 'react';
import Viewer3D from '../../Viewer3D';
const urls = (v) => String(v ?? '').match(/https?:\/\/[^\s,;]+/g) || [];
const iconFor = (n) => /photo/i.test(n) ? '\u{1F4F7}' : /video/i.test(n) ? '\u{1F3AC}' : /draw/i.test(n) ? '\u{1F4D0}' : '\u{1F517}';
const Links = ({ name, v }) => urls(v).map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer" title={u} style={{ textDecoration: 'none', fontSize: 20, marginRight: 6 }}>{iconFor(name)}</a>);

function Cell({ c, v, pending, onSave }) {
  const shown = pending !== undefined ? pending : v;
  const cls = pending !== undefined ? 'pend' : '';
  const isLink = /link|url/i.test(c.name); if (c.readOnly) return <td className="ro" title="Read-only in Revit">{isLink && urls(v).length ? <Links name={c.name} v={v} /> : String(v ?? '')}</td>;
  if (c.type === 'bool')
    return <td className={cls}><input type="checkbox" aria-label={c.name} checked={!!shown} onChange={(e) => onSave(e.target.checked)} /></td>;
  return (
    <td className={cls}>
    {isLink && <Links name={c.name} v={shown} />}
      <input style={isLink ? { width: 90 } : undefined} key={String(shown)} defaultValue={shown ?? ''} type={c.type === 'number' ? 'number' : 'text'} step="any" aria-label={c.name}
        onBlur={(e) => {
          const t = e.target.value;
          const n = c.type === 'number' ? (t === '' ? null : Number(t)) : t;
          if (n !== shown) onSave(n);
        }} />
    </td>
  );
}

export default function Schedule({ params }) {
  const id = decodeURIComponent(params.id);
  const [d, setD] = useState(null);
  const [denied, setDenied] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch('/api/schedules/' + encodeURIComponent(id));
    if (r.ok) setD(await r.json()); else if (r.status === 403 || r.status === 401) setDenied(true);
  }, [id]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  if (!d) return <main><p className="muted">{denied ? 'You do not have access to this schedule.' : 'Loading schedule…'}</p></main>;

  const pend = {};
  d.pending.forEach((e) => (pend[e.element_id + '|' + e.col] = e.value));
  const rowsPending = new Set(d.pending.map((e) => e.element_id));
  // d.editCols: this person may change only these Yes/No columns (set in Revit, SINA-TAEIDI > Site access); everything else is locked. null = the old rule.
  const colFor = (c) => (d.editCols ? (d.editCols.some((o) => String(o).toLowerCase().replace(/[\s\-_]/g, '') === String(c.name).toLowerCase().replace(/[\s\-_]/g, '')) && c.type === 'bool' && !c.readOnly ? c : { ...c, readOnly: true }) : d.canEdit === false ? { ...c, readOnly: true } : c);
  async function save(eid, col, value) {
    setD((x) => ({ ...x, pending: [...x.pending.filter((e) => !(e.element_id === eid && e.col === col)), { element_id: eid, col, value }] }));
    await fetch(`/api/schedules/${encodeURIComponent(id)}/edits`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ elementId: eid, col, value }) });
  }
  return (
    <main className="wide">
      <p><a href="/">All jobs</a>{d.job ? <> / <a href={'/j/' + encodeURIComponent(d.job)}>{d.job}</a></> : null}</p>
      <h1>{d.name}</h1>
    <Viewer3D job={d.job || ''} />
      <p className={d.pending.length ? 'status wait' : 'status'}>
        {d.pending.length ? `${d.pending.length} change${d.pending.length > 1 ? 's' : ''} waiting for Revit. The add-in applies them on its next check.` : 'Everything here matches Revit.'}
      </p>
      {d.failed.length > 0 && <p className="status bad">Revit rejected {d.failed.length} recent change(s), for example: {d.failed[0].note}</p>}
      <div className="scroll">
        <table>
          <thead><tr><th>Element ID</th>{d.columns.map((c) => <th key={c.name}>{c.name}{c.unit ? ` (${c.unit})` : ''}{c.readOnly ? ' 🔒' : ''}</th>)}</tr></thead>
          <tbody>
            {d.rows.map((r) => (
              <tr key={r.element_id} className={rowsPending.has(r.element_id) ? 'rowp' : ''}>
                <td className="id">{r.element_id}</td>
                {d.columns.map((c) => (
                  <Cell key={c.name} c={colFor(c)} v={r.vals?.[c.name]} pending={pend[r.element_id + '|' + c.name]} onSave={(val) => save(r.element_id, c.name, val)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
