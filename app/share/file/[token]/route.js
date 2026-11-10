import { visitsDb } from '../../../../lib/visits';
import { serveBlob } from '../../../../lib/blobserve';
export const dynamic = 'force-dynamic';

// Public link to a single shared photo / video (anyone with the link, no login).
export async function GET(req, { params }) {
  const sql = await visitsDb();
  const [m] = await sql`select pathname from media where share = ${String(params.token || '')}`;
  if (!m) return new Response('Not found', { status: 404 });
  return serveBlob(req, m.pathname);
}
