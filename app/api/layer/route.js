import { db } from '../../../lib/db';
import { currentUser, canJob } from '../../../lib/user';
import { getLayer } from '../../../lib/layer';
export const dynamic = 'force-dynamic';
// The signed-in person's own layer for one job (their changes that are not in the main model yet).
export async function GET(req) {
  const job = new URL(req.url).searchParams.get('job') || '';
  const u = await currentUser();
  if (!u || !canJob(u, job)) return Response.json({ error: 'No access' }, { status: 403 });
  const L = await getLayer(await db(), job, u.name || 'admin');
  return Response.json({ edits: L.edits, look: L.look, rev: L.rev, pending: !L.look && L.edits.length > 0 });
}
