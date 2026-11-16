import { db } from '../../../lib/db';
import { currentUser, canJob, canEdit, isAdmin } from '../../../lib/user';
import { getCamViews, putCamViews, CAM_ICONS } from '../../../lib/camviews';
export const dynamic = 'force-dynamic';

const num3 = (a) => Array.isArray(a) && a.length === 3 && a.every((x) => Number.isFinite(Number(x))) ? a.map(Number) : null;

// GET ?job=X   everyone with access to the job: the saved views, and whether this person may make them (admin) or attach them to an Issue (editor).
// POST         admin: { job, name, icon, cam, view }   a new saved view; the name must be unique in the job.
// DELETE ?job=X&id=Y   admin.
// every view has a number 1..20 (the smallest free one when it is made), shown on its camera icon; older views without one get theirs here
const freeN = (list) => { const used = new Set(list.map((v) => v.n).filter(Boolean)); let n = 1; while (used.has(n)) n++; return n; };
export async function GET(req) {
  const job = new URL(req.url).searchParams.get('job') || '';
  const u = await currentUser();
  if (!u || !canJob(u, job)) return Response.json({ error: 'No access' }, { status: 403 });
  const sql = await db();
  const list = await getCamViews(sql, job);
  if (list.some((v) => !v.n)) { for (const v of list) if (!v.n) v.n = freeN(list); await putCamViews(sql, job, list); }
  let sections = [];
  if (isAdmin(u)) {
    try {
      await sql`create table if not exists sections(id text primary key, job text not null, name text not null, pos int default 0, created_at timestamptz default now())`;
      sections = (await sql`select id, name from sections where job = ${job} order by pos, created_at`).map((x) => ({ id: x.id, name: x.name }));
    } catch (e) { sections = []; }
  }
  return Response.json({ views: list, admin: isAdmin(u), editor: canEdit(u), sections });
}
// PATCH  admin: { job, id, name? , qr? }   rename a view (unique name) and/or connect a QR section to it ('' = disconnect).
export async function PATCH(req) {
  const u = await currentUser();
  if (!isAdmin(u)) return Response.json({ error: 'Admins only' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '');
  const sql = await db();
  const list = await getCamViews(sql, job);
  const v = list.find((x) => x.id === b.id);
  if (!v) return Response.json({ error: 'View not found.' }, { status: 404 });
  if (typeof b.name === 'string') {
    const name = b.name.trim().slice(0, 60);
    if (!name) return Response.json({ error: 'A name is needed.' }, { status: 400 });
    if (list.some((x) => x.id !== v.id && x.name.toLowerCase() === name.toLowerCase())) return Response.json({ error: 'A view with this name already exists.' }, { status: 409 });
    v.name = name;
  }
  if (typeof b.qr === 'string') {
    if (b.qr) {
      const [s] = await sql`select id, name from sections where id = ${b.qr} and job = ${job}`;
      if (!s) return Response.json({ error: 'That QR was not found in this job.' }, { status: 404 });
      v.qr = s.id; v.qrName = s.name;
    } else { delete v.qr; delete v.qrName; }
  }
  await putCamViews(sql, job, list);
  return Response.json({ ok: true, views: list });
}
export async function POST(req) {
  const u = await currentUser();
  if (!isAdmin(u)) return Response.json({ error: 'Admins only' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '');
  const name = String(b.name || '').trim().slice(0, 60);
  if (!job || !name) return Response.json({ error: 'A name is needed.' }, { status: 400 });
  const c = b.cam || {};
  const cam = { pos: num3(c.pos), target: num3(c.target), up: num3(c.up), persp: c.persp !== false };
  if (!cam.pos || !cam.target || !cam.up) return Response.json({ error: 'The camera could not be read.' }, { status: 400 });
  const sql = await db();
  const list = await getCamViews(sql, job);
  if (list.some((v) => v.name.toLowerCase() === name.toLowerCase())) return Response.json({ error: 'A view with this name already exists.' }, { status: 409 });
  if (list.length >= 200) return Response.json({ error: 'A job can have up to 200 saved views.' }, { status: 400 });
  const id = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  list.push({ id, n: freeN(list), name, icon: CAM_ICONS[b.icon] ? b.icon : 'camera', cam, view: String(b.view || ''), by: u.name || 'admin', at: Date.now() });
  await putCamViews(sql, job, list);
  return Response.json({ ok: true, views: list });
}
export async function DELETE(req) {
  const u = await currentUser();
  if (!isAdmin(u)) return Response.json({ error: 'Admins only' }, { status: 403 });
  const p = new URL(req.url).searchParams;
  const job = p.get('job') || '', id = p.get('id') || '';
  const sql = await db();
  const list = (await getCamViews(sql, job)).filter((v) => v.id !== id);
  await putCamViews(sql, job, list);
  return Response.json({ ok: true, views: list });
}
