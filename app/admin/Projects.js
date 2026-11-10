'use client';
import { useEffect, useState, useCallback } from 'react';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default function Projects() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [job, setJob] = useState('');
  const [name, setName] = useState('');
  const [names, setNames] = useState({});
  const [shown, setShown] = useState({});
  const [qr, setQr] = useState({});

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/sections', { cache: 'no-store' });
    if (!r.ok) { setMsg('Could not load projects (' + r.status + ')'); return; }
    const j = await r.json();
    setD(j);
    setJob((cur) => cur || j.jobs[0] || '');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function api(method, body, query) {
    setMsg('Saving…');
    const r = await fetch('/api/admin/sections' + (query || ''), { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Saved' : j.error || 'Failed (' + r.status + ')');
    if (r.ok) await load();
    return r.ok;
  }

  async function makeQr(id) {
    const QR = (await import('qrcode')).default;
    return QR.toDataURL(location.origin + '/q/' + id, { width: 512, margin: 2, errorCorrectionLevel: 'M' });
  }
  async function generate(id) {
    if (!qr[id]) setQr({ ...qr, [id]: await makeQr(id) });
    setShown({ ...shown, [id]: !shown[id] });
  }
  async function printAll(list) {
    const w = window.open('', '_blank');
    if (!w) { setMsg('Allow pop-ups to print the QR sheet'); return; }
    w.document.write('<p style="font:16px system-ui">Preparing…</p>');
    const items = [];
    for (const s of list) items.push({ s, img: qr[s.id] || (await makeQr(s.id)) });
    w.document.open();
    w.document.write('<!doctype html><title>QR codes - ' + esc(job) + '</title><style>body{margin:0;font-family:system-ui,sans-serif}.g{display:grid;grid-template-columns:repeat(2,1fr);gap:10mm;padding:12mm}.c{break-inside:avoid;text-align:center;border:1px solid #bbb;border-radius:8px;padding:8mm}.c img{width:100%;max-width:70mm}.j{font-size:12pt;color:#555}.n{font-size:16pt;font-weight:700;margin-top:2mm}@page{margin:8mm}</style><div class="g">' +
      items.map((x) => '<div class="c"><img src="' + x.img + '"><div class="j">' + esc(job) + '</div><div class="n">' + esc(x.s.name) + '</div></div>').join('') +
      '</div><script>setTimeout(function(){window.print()},400)<\/script>');
    w.document.close();
  }

  if (!d) return <p className="muted">{msg || 'Loading…'}</p>;
  const list = d.sections.filter((s) => s.job === job);
  const inp = { padding: '8px', fontSize: 15, boxSizing: 'border-box' };
  const cell = { padding: '8px 6px', verticalAlign: 'top', borderTop: '1px solid #cfd8dc' };
  const btn = { padding: '7px 12px', fontSize: 14, cursor: 'pointer' };
  return (
    <>
      <p className="muted">Split each project into sections. Every section gets its own QR code. {msg && <b style={{ marginLeft: 8 }}>{msg}</b>}</p>
      {d.jobs.length === 0 ? <p className="muted">No projects yet. They appear here after the first Revit sync.</p> : (
        <>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span className="muted" style={{ display: 'block', marginBottom: 4 }}>Project</span>
            <select style={{ ...inp, minWidth: 240, maxWidth: '100%' }} value={job} onChange={(e) => setJob(e.target.value)}>
              {d.jobs.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </label>
          <div className="scroll">
            <table style={{ width: '100%' }}>
              <thead><tr><th style={{ width: 40 }}>#</th><th>Section name</th><th>QR code</th><th></th></tr></thead>
              <tbody>
                {list.map((s, i) => (
                  <tr key={s.id}>
                    <td style={cell}>{i + 1}</td>
                    <td style={cell}>
                      <input style={{ ...inp, width: '100%', minWidth: 160 }} value={names[s.id] ?? s.name} onChange={(e) => setNames({ ...names, [s.id]: e.target.value })} onBlur={() => { const v = (names[s.id] ?? s.name).trim(); if (v && v !== s.name) api('PUT', { id: s.id, name: v }); }} />
                    </td>
                    <td style={cell}>
                      <button style={btn} onClick={() => generate(s.id)}>{shown[s.id] ? 'Hide QR' : 'Generate QR'}</button>
                      {shown[s.id] && qr[s.id] && (
                        <div style={{ marginTop: 8 }}>
                          <img src={qr[s.id]} alt={'QR code for ' + s.name} width={160} height={160} style={{ display: 'block', border: '1px solid #cfd8dc' }} />
                          <a href={qr[s.id]} download={(job + '-' + s.name).replace(/[^\w.-]+/g, '_') + '.png'} style={{ fontSize: 14 }}>Download PNG</a>
                        </div>
                      )}
                    </td>
                    <td style={cell}><button style={btn} onClick={() => { if (confirm('Delete section ' + s.name + '? Its QR code will stop working.')) api('DELETE', null, '?id=' + encodeURIComponent(s.id)); }}>Delete</button></td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={4} style={cell} className="muted">No sections yet. Add the first one below.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
            <input style={{ ...inp, flex: '1 1 220px', maxWidth: 360 }} placeholder="New section name, e.g. Section 1 Back" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) api('POST', { job, name }).then((ok) => ok && setName('')); }} />
            <button style={{ ...btn, fontSize: 15 }} disabled={!name.trim()} onClick={async () => { if (await api('POST', { job, name })) setName(''); }}>Add section</button>
            <button style={{ ...btn, fontSize: 15, marginLeft: 'auto' }} disabled={!list.length} onClick={() => printAll(list)}>Print all QR codes (PDF)</button>
          </div>
          <p className="muted" style={{ fontSize: 14 }}>In the print window choose “Save as PDF” to get a file you can send.</p>
        </>
      )}
    </>
  );
}
