import { db } from '../../../lib/db';
import { currentUser, canJob, canEdit, canSee } from '../../../lib/user';
export const dynamic = 'force-dynamic';

// The section box kept for an element (the small model window beside a card): { [elementId]: { min:[x,y,z], max:[x,y,z], by, at } }. Editors and admins save or reset it.
const key = (job) => 'elemsec:' + job;
const read = async (sql, job) => { const [r] = await sql`select value from settings where key = ${key(job)}`; return r && r.value && typeof r.value === 'object' && !Array.isArray(r.value) ? r.value : {}; };
const write = (sql, job, v) => sql`insert into settings(key, value) values(${key(job)}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set value = excluded.value`;
const v3 = (a) => Array.isArray(a) && a.length === 3 && a.every((x) => Number.isFinite(Number(x))) ? a.map(Number) : null;

export async function GET(req) {
  const job = new URL(req.url).searchParams.get('job') || '';
  const u = await currentUser();
  if (!u || !canSee(u, job)) return Response.json({ error: 'No access' }, { status: 403 });
  return Response.json({ boxes: await read(await db(), job), can: !!canEdit(u) });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '');
  const u = await currentUser();
  if (!u || !canJob(u, job) || !canEdit(u)) return Response.json({ error: 'Only an editor or a manager can save this box.' }, { status: 403 });
  const el = String(b.element || '');
  const min = v3(b.min), max = v3(b.max);
  if (!/^\d+$/.test(el) || !min || !max) return Response.json({ error: 'Nothing to save.' }, { status: 400 });
  const sql = await db();
  const all = await read(sql, job);
  all[el] = { min, max, by: u.name || '', at: Date.now() };
  await write(sql, job, all);
  return Response.json({ ok: true, boxes: all });
}
export async function DELETE(req) {
  const q = new URL(req.url).searchParams;
  const job = q.get('job') || '';
  const u = await currentUser();
  if (!u || !canJob(u, job) || !canEdit(u)) return Response.json({ error: 'Only an editor or a manager can reset this box.' }, { status: 403 });
  const sql = await db();
  const all = await read(sql, job);
  delete all[q.get('element') || ''];
  await write(sql, job, all);
  return Response.json({ ok: true, boxes: all });
}
