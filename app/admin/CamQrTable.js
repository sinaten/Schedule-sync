'use client';
import { useEffect, useState } from 'react';

// Admin > Settings: the QR codes made from saved camera views (one row per view that has a QR).
const cell = { padding: '8px 10px', borderBottom: '1px solid #e3e8ea', verticalAlign: 'middle' };
const btn = { padding: '6px 12px', fontSize: 14, borderRadius: 8, border: '1px solid #cfd8dc', background: '#fff', cursor: 'pointer' };
export default function CamQrTable() {
  const [items, setItems] = useState(null);
  const [img, setImg] = useState({});
  const [msg, setMsg] = useState('');
  useEffect(() => {
    fetch('/api/admin/camqr', { cache: 'no-store' }).then((r) => r.json()).then(async (j) => {
      const list = j.items || [];
      setItems(list);
      const { camQrPng } = await import('../../lib/camqrimg');
      const m = {};
      for (const x of list) m[x.qr] = await camQrPng(location.origin + '/cv/' + x.qr, x.n, x.name);
      setImg(m);
    }).catch(() => setItems([]));
  }, []);
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 1600); };
  async function copyImg(x) {
    try {
      const blob = await (await fetch(img[x.qr])).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash('QR image copied');
    } catch (e) { flash('Could not copy the image. Use Download.'); }
  }
  async function copyLink(x) {
    try { await navigator.clipboard.writeText(location.origin + '/cv/' + x.qr); flash('Link copied'); } catch (e) { flash('Could not copy.'); }
  }
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ marginBottom: 6 }}>QR codes of saved camera views</h2>
      <p className="muted">Made with Generate QR in a job's Saved views. Every one is also a section in Projects. {msg && <b style={{ marginLeft: 8 }}>{msg}</b>}</p>
      {items === null ? <p className="muted">Loading...</p> : items.length === 0 ? <p className="muted">No QR codes yet.</p> : (
        <div className="scroll">
          <table style={{ width: '100%' }}>
            <thead><tr><th style={{ width: 40 }}>#</th><th>Job</th><th>Camera view</th><th>QR</th><th></th></tr></thead>
            <tbody>
              {items.map((x, i) => (
                <tr key={x.job + x.id}>
                  <td style={cell}>{i + 1}</td>
                  <td style={cell}>{x.job}</td>
                  <td style={cell}><b>{x.n ? x.n + ' ' : ''}</b>{x.name}</td>
                  <td style={cell}>{img[x.qr] ? <img src={img[x.qr]} alt={'QR code for ' + x.name} width={110} style={{ display: 'block', height: 'auto', border: '1px solid #cfd8dc' }} /> : '...'}</td>
                  <td style={cell}>
                    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" style={btn} onClick={() => copyImg(x)} disabled={!img[x.qr]}>Copy QR</button>
                      <button type="button" style={btn} onClick={() => copyLink(x)}>Copy link</button>
                      {img[x.qr] && <a href={img[x.qr]} download={(x.job + '-' + x.name).replace(/[^\w.-]+/g, '_') + '.png'} style={{ ...btn, textDecoration: 'none', color: 'inherit' }}>Download PNG</a>}
                      <a href={'/qr/' + x.qr} style={{ ...btn, textDecoration: 'none', color: 'inherit' }}>PDF</a>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
