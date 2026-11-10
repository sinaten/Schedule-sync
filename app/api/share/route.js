import { currentUser, canJob, canEdit } from '../../../lib/user';
import { visitsDb } from '../../../lib/visits';
export const dynamic = 'force-dynamic';

// Public "anyone with the link" share link for one section's photos and videos.
async function guard(sectionId) {
  const u = await currentUser();
  if (!u) return { res: Response.json({ error: 'Login required' }, { status: 401 }) };
  const sql = await visitsDb();
  const [s] = await sql`select id, job, share from sections where id = ${String(sectionId || '')}`;
  if (!s || !canJob(u, s.job) || !canEdit(u)) return { res: Response.json({ error: 'Not allowed' }, { status: 403 }) };
  return { sql, s };
}
const link = (req, t) => (t ? new URL(req.url).origin + '/share/' + t : null);

export async function GET(req) {
  const g = await guard(new URL(req.url).searchParams.get('sectionId'));
  if (g.res) return g.res;
  return Response.json({ url: link(req, g.s.share) });
}

// Create (or return the existing) link.
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const g = await guard(b.sectionId);
  if (g.res) return g.res;
  let t = g.s.share;
  if (!t) {
    t = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    await g.sql`update sections set share = ${t} where id = ${g.s.id}`;
  }
  return Response.json({ url: link(req, t) });
}

// Stop sharing: the old link stops working.
export async function DELETE(req) {
  const g = await guard(new URL(req.url).searchParams.get('sectionId'));
  if (g.res) return g.res;
  await g.sql`update sections set share = null where id = ${g.s.id}`;
  return Response.json({ ok: true });
}
