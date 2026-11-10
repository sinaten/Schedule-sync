import { serveBlob } from '../../../../lib/blobserve';
import { currentUser, canJob } from '../../../../lib/user';
import { visitsDb } from '../../../../lib/visits';
export const dynamic = 'force-dynamic';

// Serves a private photo / video, only to signed-in users who may see the job it belongs to.
export async function GET(req) {
  const u = await currentUser();
  if (!u) return new Response('Login required', { status: 401 });
  const p = new URL(req.url).searchParams.get('p') || '';
  const sql = await visitsDb();
  const [m] = await sql`select m.pathname, v.job from media m join visits v on v.id = m.visit_id where m.pathname = ${p}`;
  if (!m || !canJob(u, m.job)) return new Response('Not found', { status: 404 });
  return serveBlob(req, m.pathname);
}
