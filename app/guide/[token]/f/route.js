import { serveBlob } from '../../../../lib/blobserve';
import { db } from '../../../../lib/db';
export const dynamic = 'force-dynamic';

// Public (no login): a form or rules file of the orientation card, only through a site's share link.
export async function GET(req, { params }) {
  const t = String(params.token || '');
  if (!/^[a-f0-9]{20,40}$/.test(t)) return new Response('Not found', { status: 404 });
  const sql = await db();
  const [r] = await sql`select value from settings where starts_with(key, 'site:') and value->>'guide' = ${t}`;
  const files = (r && r.value && r.value.orientation && r.value.orientation.files) || [];
  const i = Number(new URL(req.url).searchParams.get('i'));
  const f = files[i];
  if (!f || !String(f.path).startsWith('sitefiles/')) return new Response('Not found', { status: 404 });
  return serveBlob(req, f.path);
}
