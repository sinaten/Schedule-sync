'use client';
import { useState } from 'react';

export default function JobList({ jobs }) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const shown = jobs.filter((j) => !t || j.label.toLowerCase().includes(t));
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
          </li>
        ))}
      </ul>
    </>
  );
}
