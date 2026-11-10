import { currentUser, canJob, canEdit } from '../../../lib/user';
import { del } from '@vercel/blob';
import { visitsDb, canManage } from '../../../lib/visits';
import { getRules, limitFor, within } from '../../../lib/mediarules';
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
  const kind = b.kind === 'video' ? 'video' : b.kind === 'scan' ? 'scan' : 'photo';
  await sql`insert into media(id, visit_id, pathname, kind, size, content_type) values(${id}, ${v.id}, ${pathname}, ${kind}, ${Number(b.size) || 0}, ${String(b.contentType || '')})`;
  return Response.json({ ok: true, id });
}

// Delete one photo / video (admins and editors: any; others: only their own).
export async function DELETE(req) {
  const u = await currentUser();
  if (!u) return Response.json({ error: 'Login required' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id') || '';
  const sql = await visitsDb();
  const [m] = await sql`select m.id, m.pathname, m.kind, m.created_at, v.job, v.username from media m join visits v on v.id = m.visit_id where m.id = ${id}`;
  if (!m) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!canManage(u, m)) return Response.json({ error: 'Not allowed' }, { status: 403 });
  if (!within(m.created_at, limitFor(u, await getRules(), 'delete'))) return Response.json({ error: 'The time allowed for deleting this file has passed' }, { status: 403 });
  if (m.kind === 'scan' && !canEdit(u)) return Response.json({ error: 'The scan photo can only be deleted by an admin or editor' }, { status: 403 });
  try { await del(m.pathname); } catch (e) { return Response.json({ error: 'Could not delete the file: ' + (e && e.message) }, { status: 500 }); }
  await sql`delete from media where id = ${id}`;
  return Response.json({ ok: true });
}
