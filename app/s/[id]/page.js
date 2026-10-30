'use client';
import { useEffect, useState, useCallback } from 'react';

function Cell({ c, v, pending, onSave }) {
  const shown = pending !== undefined ? pending : v;
  const cls = pending !== undefined ? 'pend' : '';
  if (c.readOnly) return <td className="ro" title="Read-only in Revit">{String(v ?? '')}</td>;
  if (c.type === 'bool')
    return <td className={cls}><input type="checkbox" aria-label={c.name} checked={!!shown} onChange={(e) => onSave(e.target.checked)} /></td>;
  return (
    <td className={cls}>
      <input key={String(shown)} defaultValue={shown ?? ''} type={c.type === 'number' ? 'number' : 'text'} step="any" aria-label={c.name}
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
  const load = useCallback(async () => {
    const r = await fetch('/api/schedules/' + encodeURIComponent(id));
    if (r.ok) setD(await r.json());
  }, [id]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  if (!d) return <main><p className="muted">Loading schedule…</p></main>;

  const pend = {};
  d.pending.forEach((e) => (pend[e.element_id + '|' + e.col] = e.value));
  const rowsPending = new Set(d.pending.map((e) => e.element_id));
  async function save(eid, col, value) {
    setD((x) => ({ ...x, pending: [...x.pending.filter((e) => !(e.element_id === eid && e.col === col)), { element_id: eid, col, value }] }));
    await fetch(`/api/schedules/${encodeURIComponent(id)}/edits`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ elementId: eid, col, value }) });
  }
  return (
    <main className="wide">
      <p><a href="/">All schedules</a></p>
      <h1>{d.name}</h1>
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
                  <Cell key={c.name} c={c} v={r.vals?.[c.name]} pending={pend[r.element_id + '|' + c.name]} onSave={(val) => save(r.element_id, c.name, val)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
