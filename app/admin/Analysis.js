'use client';
import { useEffect, useState } from 'react';

// Admin only: one row per person. Photos & videos = how many were taken near the QR location (green), a bit away (orange) or far (red).
const GREEN = '#2e9d57', ORANGE = '#f08c1a', RED = '#d93025';

export default function Analysis() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    fetch('/api/admin/analysis', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.rows) setD(j); else setMsg(j.error || 'Could not load'); }).catch(() => setMsg('Could not load'));
  }, []);
  if (!d) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#6b7b83', borderBottom: '1px solid #e1e5e8', whiteSpace: 'nowrap' };
  const td = { padding: '10px', fontSize: 14, borderBottom: '1px solid #eef1f3', verticalAlign: 'middle' };
  const pc = (n, t) => (t ? Math.round((n / t) * 100) : 0);
  return (
    <div>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
        <span style={{ color: GREEN, fontWeight: 600 }}>Green</span> up to {d.green} m from the QR &middot; <span style={{ color: ORANGE, fontWeight: 600 }}>orange</span> up to {d.orange} m &middot; <span style={{ color: RED, fontWeight: 600 }}>red</span> further. Gray = could not be checked (no location saved).
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>User</th>
              <th style={th}>Role</th>
              <th style={th}>Photos &amp; videos</th>
              <th style={th}>Check-in</th>
              <th style={th}>Check-out</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => {
              const t = r.g + r.o + r.r;
              const all = t + r.u;
              return (
                <tr key={r.username}>
                  <td style={{ ...td, color: '#8a979d' }}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.username}</td>
                  <td style={{ ...td, color: '#45565e' }}>{r.role}</td>
                  <td style={{ ...td, minWidth: 210 }}>
                    {all === 0 ? <span className="muted">No photos yet</span> : (
                      <div>
                        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#e6eaed', maxWidth: 220 }}>
                          {r.g > 0 && <span style={{ width: (r.g / all) * 100 + '%', background: GREEN }} />}
                          {r.o > 0 && <span style={{ width: (r.o / all) * 100 + '%', background: ORANGE }} />}
                          {r.r > 0 && <span style={{ width: (r.r / all) * 100 + '%', background: RED }} />}
                          {r.u > 0 && <span style={{ width: (r.u / all) * 100 + '%', background: '#c3cbd0' }} />}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          <b style={{ color: GREEN }}>{pc(r.g, t)}%</b> &middot; <b style={{ color: ORANGE }}>{pc(r.o, t)}%</b> &middot; <b style={{ color: RED }}>{pc(r.r, t)}%</b>
                          <span className="muted"> &nbsp;{all} {all === 1 ? 'file' : 'files'}{r.u > 0 ? ', ' + r.u + ' unchecked' : ''}</span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, color: '#b5bec3' }}>&mdash;</td>
                  <td style={{ ...td, color: '#b5bec3' }}>&mdash;</td>
                </tr>
              );
            })}
            {!d.rows.length && <tr><td style={td} colSpan={6}><span className="muted">No users yet.</span></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
