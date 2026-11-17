'use client';
import { useState } from 'react';

// Admin > Workflow. For now only the place for Milestones, so it is not forgotten. The order and the steps are set up later.
export default function Workflow() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>The steps a project goes through, in order.</p>
      <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: '#fff', maxWidth: 720 }}>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 14px', border: 0, background: 'transparent', font: 'inherit', fontWeight: 600, fontSize: 17, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}>
          <span>Milestones</span>
          <span aria-hidden="true" style={{ marginLeft: 'auto', width: 8, height: 8, borderRight: '2px solid var(--mut)', borderBottom: '2px solid var(--mut)', transform: open ? 'rotate(45deg)' : 'rotate(-45deg)', transition: 'transform .15s' }} />
        </button>
        {open && (
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="muted">Not set up yet. This is where the order of the steps will go.</div>
            <div className="muted" style={{ fontSize: 14 }}>Planned: a QR code can be a milestone. Scanning it records the photo, time and place, and the step (for example Orientation done) is marked as finished by itself.</div>
          </div>
        )}
      </div>
    </>
  );
}
