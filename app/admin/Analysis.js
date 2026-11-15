'use client';
import { useEffect, useState } from 'react';

// Admin only: one row per person. Photos & videos = how many were taken near the QR location (green), a bit away (orange) or far (red).
const GREEN = '#2e9d57', ORANGE = '#f08c1a', RED = '#d93025';

const BLUE = '#2f7dd1';
// Usage: bars = changes sent to the phone/site counter (blue) and whole-model conversions that cost Autodesk tokens (red). Times are Columbus time.
function Bars({ items, h = 110 }) {
  const mx = Math.max(1, ...items.map((i) => i.a + i.b));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: h + 18, overflowX: 'auto' }}>
      {items.map((i) => (
        <div key={i.k} title={i.k + ': ' + i.a + ' changes, ' + i.b + ' models'} style={{ flex: '1 0 14px', maxWidth: 34, textAlign: 'center' }}>
          <div style={{ height: h, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            {i.b > 0 && <div style={{ height: (i.b / mx) * h, background: RED, borderRadius: '3px 3px 0 0' }} />}
            {i.a > 0 && <div style={{ height: (i.a / mx) * h, background: BLUE, borderRadius: i.b ? 0 : '3px 3px 0 0' }} />}
          </div>
          <div style={{ fontSize: 10, color: '#8a979d', marginTop: 2 }}>{i.l}</div>
        </div>
      ))}
    </div>
  );
}
function Usage({ u }) {
  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#6b7b83', borderBottom: '1px solid #e1e5e8', whiteSpace: 'nowrap' };
  const td = { padding: '10px', fontSize: 14, borderBottom: '1px solid #eef1f3' };
  const today = new Date();
  const dk = [];
  for (let i = 13; i >= 0; i--) { const x = new Date(today.getTime() - i * 864e5); dk.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(x)); }
  const days = dk.map((k) => ({ k, l: k.slice(8), a: 0, b: 0 }));
  for (const r of u.days) { const x = days.find((y) => y.k === r.day); if (x) { if (r.kind === 'model') x.b += r.n; else if (r.kind === 'change') x.a += r.n; } }
  const hrs = Array.from({ length: 24 }, (_, h) => ({ k: h + ':00', l: String(h), a: 0, b: 0 }));
  for (const r of u.hours) { const x = hrs[r.h]; if (x) { if (r.kind === 'model') x.b += r.n; else if (r.kind === 'change') x.a += r.n; } }
  const ago = (t) => { if (!t) return '\u2014'; const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Usage</h3>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
        <span style={{ color: BLUE, fontWeight: 600 }}>Blue</span> = changes (counter) &middot; <span style={{ color: RED, fontWeight: 600 }}>red</span> = whole-model conversions (they use Autodesk tokens). Counted from the day this was added.
      </p>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7b83', margin: '8px 0 4px' }}>Last 14 days</div>
      <Bars items={days} />
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7b83', margin: '14px 0 4px' }}>By hour of day (last 14 days)</div>
      <Bars items={hrs} />
      <div style={{ overflowX: 'auto', marginTop: 20 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
          <thead>
            <tr><th style={th}>User</th><th style={th}>Notes</th><th style={th}>Changes</th><th style={th}>Models</th><th style={th}>Active hours</th><th style={th}>Last activity</th></tr>
          </thead>
          <tbody>
            {u.people.map((p) => (
              <tr key={p.username}>
                <td style={{ ...td, fontWeight: 600 }}>{p.username}</td>
                <td style={td}>{p.notes}</td>
                <td style={td}>{p.changes}</td>
                <td style={{ ...td, color: p.models ? RED : undefined, fontWeight: p.models ? 600 : 400 }}>{p.models}</td>
                <td style={td}>{p.hours}</td>
                <td style={{ ...td, color: '#45565e' }}>{ago(p.last)}</td>
              </tr>
            ))}
            {!u.people.length && <tr><td style={td} colSpan={6}><span className="muted">No activity yet.</span></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
      {d.usage && <Usage u={d.usage} />}
    </div>
  );
}
