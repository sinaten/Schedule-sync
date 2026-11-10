import { serveBlob } from '../../../../lib/blobserve';
import { currentUser, canEdit } from '../../../../lib/user';
import { visitsDb, canManage } from '../../../../lib/visits';
export const dynamic = 'force-dynamic';

// Serves a private photo / video. Admins and editors see everything; other users only files from their own visits, and never the QR scan photo.
export async function GET(req) {
  const u = await currentUser();
  if (!u) return new Response('Login required', { status: 401 });
  const p = new URL(req.url).searchParams.get('p') || '';
  const sql = await visitsDb();
  const [m] = await sql`select m.pathname, m.kind, v.job, v.username from media m join visits v on v.id = m.visit_id where m.pathname = ${p}`;
  if (!m || !canManage(u, m) || (m.kind === 'scan' && !canEdit(u))) return new Response('Not found', { status: 404 });
  return serveBlob(req, m.pathname);
}
