import { get } from '@vercel/blob';

// Streams a private blob. Supports HTTP Range (needed so iPhone Safari can play video) in chunks of at most 3 MB.
export async function serveBlob(req, pathname) {
  const r = await get(pathname, { access: 'private' });
  if (!r || r.statusCode !== 200) return new Response('Not found', { status: 404 });
  const base = {
    'Content-Type': r.blob.contentType || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-cache',
    'Accept-Ranges': 'bytes',
  };
  const range = req.headers.get('range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!m) return new Response(r.stream, { headers: base });
  const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
  const total = buf.length;
  let start, end;
  if (m[1] === '') {
    start = Math.max(0, total - parseInt(m[2], 10));
    end = total - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
  }
  if (!(start <= end) || start >= total) {
    return new Response(null, { status: 416, headers: { ...base, 'Content-Range': 'bytes */' + total } });
  }
  end = Math.min(end, start + 3 * 1024 * 1024 - 1);
  return new Response(buf.subarray(start, end + 1), {
    status: 206,
    headers: { ...base, 'Content-Range': 'bytes ' + start + '-' + end + '/' + total, 'Content-Length': String(end - start + 1) },
  });
}
