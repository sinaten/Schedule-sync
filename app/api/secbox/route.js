import { db } from '../../../lib/db';
import { currentUser, canJob, canEdit, canSee } from '../../../lib/user';
export const dynamic = 'force-dynamic';

// Saved section boxes of a job: [{ id, name, planes:[[x,y,z,w] x 6], by, at }]. Everyone with access to the job can show them; editors and admins make and delete them.
const key = (job) => 'secbox:' + job;
const read = async (sql, job) => { const [r] = await sql`select value from settings where key = ${key(job)}`; return Array.isArray(r && r.value) ? r.value : []; };
const write = (sql, job, list) => sql`insert into settings(key, value) values(${key(job)}, ${JSON.stringify(list)}::jsonb) on conflict (key) do update set value = excluded.value`;
const okPlanes = (p) => Array.isArray(p) && p.length >= 1 && p.length <= 12 && p.every((a) => Array.isArray(a) && a.length === 4 && a.every((x) => Number.isFinite(Number(x))));

export async function GET(req) {
  const job = new URL(req.url).searchParams.get('job') || '';
  const u = await currentUser();
  if (!u || !canSee(u, job)) return Response.json({ error: 'No access' }, { status: 403 });
  const sql = await db();
  return Response.json({ boxes: await read(sql, job), can: !!canEdit(u) });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '');
  const u = await currentUser();
  if (!u || !canJob(u, job) || !canEdit(u)) return Response.json({ error: 'Only an editor or a manager can save a section box.' }, { status: 403 });
  const name = String(b.name || '').trim().slice(0, 60);
  if (!name) return Response.json({ error: 'A name is needed.' }, { status: 400 });
  if (!okPlanes(b.planes)) return Response.json({ error: 'There is no box to save yet.' }, { status: 400 });
  const sql = await db();
  const list = await read(sql, job);
  if (list.some((x) => x.name.toLowerCase() === name.toLowerCase())) return Response.json({ error: 'A box with this name already exists.' }, { status: 409 });
  const box = { id: crypto.randomUUID().replace(/-/g, '').slice(0, 10), name, planes: b.planes.map((a) => a.map(Number)), by: u.name || '', at: Date.now() };
  list.push(box);
  await write(sql, job, list);
  return Response.json({ ok: true, boxes: list });
}
export async function DELETE(req) {
  const q = new URL(req.url).searchParams;
  const job = q.get('job') || '';
  const u = await currentUser();
  if (!u || !canJob(u, job) || !canEdit(u)) return Response.json({ error: 'Only an editor or a manager can delete a section box.' }, { status: 403 });
  const sql = await db();
  const list = (await read(sql, job)).filter((x) => x.id !== q.get('id'));
  await write(sql, job, list);
  return Response.json({ ok: true, boxes: list });
}
