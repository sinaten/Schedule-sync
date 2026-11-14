'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JobList({ jobs, admin }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const router = useRouter();
  const t = q.trim().toLowerCase();
  const shown = jobs.filter((j) => !t || j.label.toLowerCase().includes(t));
  async function del(j) {
    if (!confirm('Delete job ' + j.label + ' with all its schedules and 3D model? This cannot be undone.')) return;
    if (!confirm('Really delete ' + j.label + '?')) return;
    setBusy(j.slug);
    try {
      const r = await fetch('/api/admin/jobs?job=' + encodeURIComponent(j.slug), { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed');
      router.refresh();
    } catch (err) { alert('Not deleted: ' + err.message); }
    setBusy('');
  }
  return (
    <>
      <input
        type="search"
        placeholder="Search job number…"
        aria-label="Search jobs"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 420, padding: '10px 12px', fontSize: 16, margin: '8px 0 16px', boxSizing: 'border-box' }}
      />
      {shown.length === 0 && <p className="muted">{jobs.length === 0 ? 'No jobs yet. Run the Revit add-in and choose the schedules to watch.' : 'No job matches “' + q + '”.'}</p>}
      <ul className="list">
        {shown.map((j) => (
          <li key={j.slug}>
            <a href={'/j/' + encodeURIComponent(j.slug)}>{j.label}</a>
            <span className="muted">{j.n} schedule{j.n === 1 ? '' : 's'}{j.model ? ' · 3D model' : ''}</span>
            {admin && j.slug !== '_none' && (
              <button type="button" onClick={() => del(j)} disabled={busy === j.slug}
                style={{ marginLeft: 'auto', font: 'inherit', fontSize: 12, padding: '2px 8px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', color: '#b00020', cursor: 'pointer' }}>
                {busy === j.slug ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
