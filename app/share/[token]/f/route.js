import { serveBlob } from '../../../../lib/blobserve';
import { visitsDb } from '../../../../lib/visits';
export const dynamic = 'force-dynamic';

// Public file for a shared section: only files that belong to that section.
export async function GET(req, { params }) {
  const p = new URL(req.url).searchParams.get('p') || '';
  const sql = await visitsDb();
  const [m] = await sql`select m.pathname from media m join visits v on v.id = m.visit_id join sections s on s.id = v.section_id where s.share = ${String(params.token || '')} and m.pathname = ${p}`;
  if (!m) return new Response('Not found', { status: 404 });
  return serveBlob(req, m.pathname);
}
