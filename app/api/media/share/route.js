import { currentUser, canEdit } from '../../../../lib/user';
import { visitsDb, canManage } from '../../../../lib/visits';
export const dynamic = 'force-dynamic';

// Public "anyone with the link" share link for ONE photo or video.
async function load(id) {
  const u = await currentUser();
  if (!u) return { res: Response.json({ error: 'Login required' }, { status: 401 }) };
  const sql = await visitsDb();
  const [m] = await sql`select m.id, m.share, m.kind, v.job, v.username from media m join visits v on v.id = m.visit_id where m.id = ${String(id || '')}`;
  if (!m || !canManage(u, m) || (m.kind === 'scan' && !canEdit(u))) return { res: Response.json({ error: 'Not found' }, { status: 404 }) };
  return { u, sql, m };
}

// Create (or return the existing) link.
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const g = await load(b.id);
  if (g.res) return g.res;
  let t = g.m.share;
  if (!t) {
    t = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    await g.sql`update media set share = ${t} where id = ${g.m.id}`;
  }
  return Response.json({ path: '/share/file/' + t });
}

// Stop sharing this file: the old link stops working.
export async function DELETE(req) {
  const g = await load(new URL(req.url).searchParams.get('id'));
  if (g.res) return g.res;
  if (!canManage(g.u, { job: g.m.job, username: g.m.username })) return Response.json({ error: 'Not allowed' }, { status: 403 });
  await g.sql`update media set share = null where id = ${g.m.id}`;
  return Response.json({ ok: true });
}
