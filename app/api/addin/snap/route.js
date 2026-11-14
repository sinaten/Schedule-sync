import { put, del } from '@vercel/blob';
import { isAddin, deny } from '../../../../lib/db';
import { snapsDb } from '../../../../lib/snaps';
export const dynamic = 'force-dynamic';
const MAX = 4 * 1024 * 1024;

// Revit add-in (x-api-key): list, upload, show/hide and delete the snapshots of a job.
export async function GET(req) {
  if (!isAddin(req)) return deny();
  const job = new URL(req.url).searchParams.get('job') || '';
  const sql = await snapsDb();
  const rows = await sql`select id, name, show, created_at from snaps where job = ${job} order by id desc`;
  return Response.json({ snaps: rows });
}

export async function POST(req) {
  if (!isAddin(req)) return deny();
  const sql = await snapsDb();
  if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
    const f = await req.formData().catch(() => null);
    const file = f && f.get('file');
    const job = String((f && f.get('job')) || '');
    if (!job || !file || typeof file === 'string' || !file.size) return Response.json({ error: 'job and file required' }, { status: 400 });
    if (file.size > MAX) return Response.json({ error: 'The picture is too big (4 MB at most)' }, { status: 413 });
    const name = String(f.get('name') || 'Snapshot').slice(0, 120);
    const show = f.get('show') !== '0';
    const r = await put('snaps/' + job + '/' + Date.now() + '.jpg', file, { access: 'private', addRandomSuffix: true, contentType: 'image/jpeg' });
    const [row] = await sql`insert into snaps(job, name, pathname, show) values(${job}, ${name}, ${r.pathname}, ${show}) returning id`;
    return Response.json({ ok: true, id: row.id });
  }
  const b = await req.json().catch(() => ({}));
  const id = parseInt(b && b.id, 10);
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  if (b.action === 'show') {
    await sql`update snaps set show = ${!!b.show} where id = ${id}`;
    return Response.json({ ok: true });
  }
  if (b.action === 'rename') {
    await sql`update snaps set name = ${String(b.name || '').slice(0, 120)} where id = ${id}`;
    return Response.json({ ok: true });
  }
  if (b.action === 'delete') {
    const [r] = await sql`delete from snaps where id = ${id} returning pathname`;
    if (r) { try { await del(r.pathname); } catch (e) { /* the row is gone; the file may stay */ } }
    return Response.json({ ok: true });
  }
  return Response.json({ error: 'unknown action' }, { status: 400 });
}
