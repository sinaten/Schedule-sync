'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Delete one photo / video (kind="media") or a whole visit folder (kind="visit"). Shown only to people who may delete it.
export default function DeleteButton({ kind, id, label, overlay }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go(e) {
    e.preventDefault(); e.stopPropagation();
    const what = kind === 'visit' ? 'this whole folder with all its photos and videos' : 'this file';
    if (!confirm('Delete ' + what + '? This cannot be undone.')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/' + (kind === 'visit' ? 'visits' : 'media') + '?id=' + encodeURIComponent(id), { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed');
      router.refresh();
    } catch (err) { alert('Not deleted: ' + err.message); setBusy(false); }
  }
  if (overlay)
    return (
      <button type="button" onClick={go} disabled={busy} aria-label="Delete"
        style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, border: 0, background: 'rgba(20,20,19,.75)', color: '#fff', fontSize: 15, lineHeight: '24px', padding: 0, cursor: 'pointer' }}>
        &times;
      </button>
    );
  return (
    <button type="button" onClick={go} disabled={busy}
      style={{ font: 'inherit', fontSize: 12, padding: '2px 8px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', color: '#b00020', cursor: 'pointer' }}>
      {busy ? 'Deleting…' : label || 'Delete'}
    </button>
  );
}
