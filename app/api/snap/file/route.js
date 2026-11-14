import { serveBlob } from '../../../../lib/blobserve';
import { currentUser, canJob } from '../../../../lib/user';
import { snapsDb } from '../../../../lib/snaps';
export const dynamic = 'force-dynamic';

// Serves one snapshot picture to people who may use its job.
export async function GET(req) {
  const id = parseInt(new URL(req.url).searchParams.get('id') || '', 10);
  const u = await currentUser();
  if (!u || !id) return new Response('Login required', { status: 401 });
  const sql = await snapsDb();
  const [r] = await sql`select job, pathname from snaps where id = ${id} and show`;
  if (!r || !canJob(u, r.job)) return new Response('Not found', { status: 404 });
  return serveBlob(req, r.pathname);
}
