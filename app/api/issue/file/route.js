import { serveBlob } from '../../../../lib/blobserve';
import { currentUser, canJob } from '../../../../lib/user';
import { issuesDb } from '../../../../lib/issues';
export const dynamic = 'force-dynamic';

// Serves a photo or file of an issue to people who may use that job.
export async function GET(req) {
  const p = new URL(req.url).searchParams.get('p') || '';
  const u = await currentUser();
  if (!u) return new Response('Login required', { status: 401 });
  const sql = await issuesDb();
  const [it] = await sql`select job from issue_items where pathname = ${p}`;
  if (!it || !canJob(u, it.job)) return new Response('Not found', { status: 404 });
  return serveBlob(req, p);
}
