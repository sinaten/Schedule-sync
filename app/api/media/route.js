import { currentUser, canJob } from '../../../lib/user';
import { visitsDb } from '../../../lib/visits';
export const dynamic = 'force-dynamic';

// Register an uploaded file in the database (called by the phone after the upload to Blob finished).
export async function POST(req) {
  const u = await currentUser();
  if (!u) return Response.json({ error: 'Login required' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const sql = await visitsDb();
  const [v] = await sql`select id, job, folder from visits where id = ${String(b.visitId || '')}`;
  if (!v || !canJob(u, v.job)) return Response.json({ error: 'No access to this visit' }, { status: 403 });
  const pathname = String(b.pathname || '');
  if (!pathname.startsWith(v.folder + '/')) return Response.json({ error: 'Bad path' }, { status: 400 });
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 14);
  const kind = b.kind === 'video' ? 'video' : 'photo';
  await sql`insert into media(id, visit_id, pathname, kind, size, content_type) values(${id}, ${v.id}, ${pathname}, ${kind}, ${Number(b.size) || 0}, ${String(b.contentType || '')})`;
  return Response.json({ ok: true, id });
}
