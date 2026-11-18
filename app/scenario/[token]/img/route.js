import { serveBlob } from '../../../../lib/blobserve';
import { db } from '../../../../lib/db';
export const dynamic = 'force-dynamic';

// Public (no login): the picture of a scenario, only through its secret link.
export async function GET(req, { params }) {
  const t = String(params.token || '');
  if (!/^[a-f0-9]{32}$/.test(t)) return new Response('Not found', { status: 404 });
  const [r] = await (await db())`select value from settings where key = ${'scn:' + t}`;
  const p = r && r.value && r.value.image && r.value.image.path;
  if (!p || !String(p).startsWith('sitefiles/') || String(p).includes('..')) return new Response('Not found', { status: 404 });
  const u = new URL(req.url); u.searchParams.set('raw', '1');
  return serveBlob(new Request(u, req), p);
}
