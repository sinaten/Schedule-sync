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
  // Opened as a page (a link tapped in the app or a browser): show a small viewer with a close button instead of a bare image,
  // so nobody gets stuck on a raw file in the installed app. Embedded <img>/<video> requests, ?raw=1 and ?dl=1 still get the file.
  try {
    const u = new URL(req.url);
    if (req.headers.get('sec-fetch-dest') === 'document' && !u.searchParams.get('raw') && !u.searchParams.get('dl')) {
      u.searchParams.set('raw', '1');
      const raw = (u.pathname + u.search).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const dl = raw + '&amp;dl=1';
      const isVideo = String(base['Content-Type']).startsWith('video/');
      const media = isVideo ? '<video src="' + raw + '" controls autoplay playsinline></video>' : '<img src="' + raw + '" alt="">';
      const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>' + (isVideo ? 'Video' : 'Photo') + '</title>'
        + '<style>html,body{margin:0;height:100%;background:#000}body{display:flex;align-items:center;justify-content:center}img,video{max-width:100vw;max-height:100vh;object-fit:contain}'
        + '#x{position:fixed;top:calc(env(safe-area-inset-top) + 12px);right:14px;width:46px;height:46px;border-radius:50%;border:0;background:#fff;display:none;align-items:center;justify-content:center;padding:0}'
        + 'a.d{position:fixed;bottom:calc(env(safe-area-inset-bottom) + 14px);left:0;right:0;text-align:center;color:#fff;font:15px -apple-system,sans-serif}</style></head><body>'
        + media
        + '<button id="x" aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141413" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
        + '<a class="d" href="' + dl + '">Download</a>'
        + '<script>var b=document.getElementById("x");var sa=window.navigator.standalone||matchMedia("(display-mode: standalone)").matches;'
        + 'if(history.length>1||window.opener||sa){b.style.display="flex";b.onclick=function(){if(history.length>1)history.back();else if(window.opener)window.close();else location.href="/"}}</script></body></html>';
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-cache' } });
    }
  } catch (e) { /* fall through to the raw file */ }
  // ?dl=1 : save as a file instead of showing it (so the person is not left on a bare image page)
  try {
    if (new URL(req.url).searchParams.get('dl')) base['Content-Disposition'] = 'attachment; filename="' + String(pathname).split('/').pop().replace(/[^\w.-]+/g, '_') + '"';
  } catch (e) { /* ignore */ }
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
