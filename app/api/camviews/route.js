import { db } from '../../../lib/db';
import { currentUser, canJob, canEdit, isAdmin } from '../../../lib/user';
import { getCamViews, putCamViews, CAM_ICONS } from '../../../lib/camviews';
export const dynamic = 'force-dynamic';

const num3 = (a) => Array.isArray(a) && a.length === 3 && a.every((x) => Number.isFinite(Number(x))) ? a.map(Number) : null;

// GET ?job=X   everyone with access to the job: the saved views, and whether this person may make them (admin) or attach them to an Issue (editor).
// POST         admin: { job, name, icon, cam, view }   a new saved view; the name must be unique in the job.
// DELETE ?job=X&id=Y   admin.
export async function GET(req) {
  const job = new URL(req.url).searchParams.get('job') || '';
  const u = await currentUser();
  if (!u || !canJob(u, job)) return Response.json({ error: 'No access' }, { status: 403 });
  return Response.json({ views: await getCamViews(await db(), job), admin: isAdmin(u), editor: canEdit(u) });
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
  const id = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  list.push({ id, name, icon: CAM_ICONS[b.icon] ? b.icon : 'camera', cam, view: String(b.view || ''), by: u.name || 'admin', at: Date.now() });
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
