import { put } from '@vercel/blob';
import { currentUser, canJob } from '../../../../lib/user';
import { issuesDb } from '../../../../lib/issues';
export const dynamic = 'force-dynamic';
const MAX = 4 * 1024 * 1024; // the website host accepts about 4.5 MB per request; photos are shrunk on the phone first

export async function POST(req) {
  const f = await req.formData().catch(() => null);
  if (!f) return Response.json({ error: 'Bad upload' }, { status: 400 });
  const file = f.get('file');
  const job = String(f.get('job') || ''), el = String(f.get('element') || '');
  const kind = f.get('kind') === 'photo' ? 'photo' : 'file';
  const u = await currentUser();
  if (!u || !job || !el || !canJob(u, job)) return Response.json({ error: 'No access' }, { status: 403 });
  if (!file || typeof file === 'string' || !file.size) return Response.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: 'The file is too big (4 MB at most)' }, { status: 413 });
  if (kind === 'photo' && !String(file.type).startsWith('image/')) return Response.json({ error: 'Only pictures can be added as photos' }, { status: 400 });
  const safe = String(file.name || 'file').replace(/[^\w.-]+/g, '_').slice(-80);
  const r = await put('issues/' + job + '/' + el + '/' + Date.now() + '-' + safe, file, { access: 'private', addRandomSuffix: true, contentType: file.type || undefined });
  const sql = await issuesDb();
  await sql`insert into issue_items(job, element_id, kind, author, name, pathname, content_type) values(${job}, ${el}, ${kind}, ${(u && u.name) || 'admin'}, ${String(file.name || safe)}, ${r.pathname}, ${String(file.type || '')})`;
  return Response.json({ ok: true });
}
