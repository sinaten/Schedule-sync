'use client';
import { useEffect, useState } from 'react';
import { upload } from '@vercel/blob/client';

// Temporary end-to-end test of the photo upload path (no camera needed).
const post = (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

export default function ScanTest() {
  const [rows, setRows] = useState(['running...']);
  useEffect(() => {
    (async () => {
      const out = [];
      try {
        const o = await (await fetch('/api/visits')).json();
        const sec = o.sections[0];
        out.push('section: ' + sec.name);
        const vr = await post('/api/visits', { sectionId: sec.id, lat: 39.96, lng: -82.99, acc: 20 });
        const v = await vr.json();
        out.push('visit: ' + vr.status + ' ' + v.folder);
        const c = document.createElement('canvas'); c.width = 96; c.height = 96;
        const x = c.getContext('2d'); x.fillStyle = '#D97757'; x.fillRect(0, 0, 96, 96); x.fillStyle = '#fff'; x.fillRect(24, 24, 48, 48);
        const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
        const res = await upload(v.folder + '/001-photo.jpg', blob, { access: 'private', handleUploadUrl: '/api/media/upload', clientPayload: JSON.stringify({ visitId: v.id }), contentType: 'image/jpeg' });
        out.push('uploaded: ' + res.pathname);
        const rr = await post('/api/media', { visitId: v.id, pathname: res.pathname, kind: 'photo', size: blob.size, contentType: 'image/jpeg' });
        out.push('registered: ' + rr.status);
        const f = await fetch('/api/media/file?p=' + encodeURIComponent(res.pathname));
        const buf = await f.arrayBuffer();
        out.push('read back: ' + f.status + ' ' + f.headers.get('content-type') + ' ' + buf.byteLength + ' bytes (sent ' + blob.size + ')');
      } catch (e) { out.push('ERROR ' + (e && e.message)); }
      setRows(out);
    })();
  }, []);
  return <pre id="res" style={{ padding: 16, fontSize: 12 }}>{rows.join('\n')}</pre>;
}
