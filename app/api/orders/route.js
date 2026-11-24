import { currentUser, canJob, canEdit, isAdmin } from '../../../lib/user';
import { ordersDb, carrierOf, dropsOf, siteOf, elsOf, cleanEls } from '../../../lib/orders';
export const dynamic = 'force-dynamic';
const nm = (u) => (u && u.name) || 'admin';
const no = () => Response.json({ error: 'No access' }, { status: 403 });
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

// GET ?job=X: the orders of the job (every person with access sees them and the tracking number), the drop-off places, and whether this person can order.
// POST { job, title, details, drop }: a new order (editors and admins).
// PATCH { job, id, tracking? , title?, details?, drop? }: the person who ordered, or an admin.
// DELETE ?job=X&id=N: the person who ordered, or an admin.
export async function GET(req) {
  const job = new URL(req.url).searchParams.get('job') || '';
  const u = await currentUser();
  if (!u || !job || !canJob(u, job)) return no();
  const sql = await ordersDb();
  if (new URL(req.url).searchParams.get('chips')) {
    const rs = await sql`select id, elements, status, eta from orders where job = ${job} and elements is not null and elements <> ''`;
    const map = {};
    for (const r of rs) for (const e of elsOf(r.elements)) (map[e] ||= []).push({ id: r.id, status: r.status, eta: r.eta });
    return Response.json({ map });
  }
  const orders = await sql`select id, elements, title, details, author, drop_token, drop_name, tracking, carrier, status, status_note, eta, last_scan, checked_at, created_at from orders where job = ${job} order by created_at desc, id desc`;
  const all = await dropsOf(sql, job);
  const flagged = all.filter((x) => x.drop);
  const drops = (flagged.length ? flagged : all).map((x) => ({ token: x.token, name: x.name }));
  const rows = orders.map((o) => { const d = all.find((x) => x.token === o.drop_token); return { ...o, elements: elsOf(o.elements), phones: d ? d.phones : [] }; });
  return Response.json({ me: nm(u), can: canEdit(u), admin: isAdmin(u) || !!u.legacy, orders: rows, drops, marked: flagged.length > 0, dropWhy: all.length ? '' : (await siteOf(sql, job)) ? 'noscn' : 'nosite' });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const job = str(b.job, 80), title = str(b.title, 160);
  const u = await currentUser();
  if (!u || !job || !canJob(u, job) || !canEdit(u)) return no();
  if (!title) return Response.json({ error: 'Write what you ordered.' }, { status: 400 });
  const sql = await ordersDb();
  const drops = await dropsOf(sql, job);
  const d = drops.find((x) => x.token === b.drop) || null;
  const [r] = await sql`insert into orders(job, title, details, author, drop_token, drop_name, elements) values(${job}, ${title}, ${str(b.details, 2000)}, ${nm(u)}, ${d ? d.token : null}, ${d ? d.name : null}, ${cleanEls(b.elements).join(',') || null}) returning id`;
  return Response.json({ ok: true, id: r.id });
}
export async function PATCH(req) {
  const b = await req.json().catch(() => ({}));
  const job = str(b.job, 80), id = parseInt(b.id, 10);
  const u = await currentUser();
  if (!u || !job || !id || !canJob(u, job)) return no();
  const sql = await ordersDb();
  const [ex] = await sql`select author from orders where id = ${id} and job = ${job}`;
  if (!ex) return Response.json({ error: 'Not found' }, { status: 404 });
  if (ex.author !== nm(u) && !(isAdmin(u) || u.legacy)) return Response.json({ error: 'Only the person who ordered, or an admin, can change this.' }, { status: 403 });
  if (typeof b.tracking === 'string') {
    const t = str(b.tracking, 60).replace(/\s+/g, '');
    await sql`update orders set tracking = ${t || null}, carrier = ${carrierOf(t) || null}, status = 'unknown', status_note = null, eta = null, last_scan = null, checked_at = null where id = ${id} and job = ${job}`;
  }
  if (typeof b.title === 'string' && str(b.title, 160)) await sql`update orders set title = ${str(b.title, 160)} where id = ${id} and job = ${job}`;
  if (Array.isArray(b.elements)) await sql`update orders set elements = ${cleanEls(b.elements).join(',') || null} where id = ${id} and job = ${job}`;
  if (typeof b.details === 'string') await sql`update orders set details = ${str(b.details, 2000)} where id = ${id} and job = ${job}`;
  if (typeof b.drop === 'string') {
    const d = (await dropsOf(sql, job)).find((x) => x.token === b.drop) || null;
    await sql`update orders set drop_token = ${d ? d.token : null}, drop_name = ${d ? d.name : null} where id = ${id} and job = ${job}`;
  }
  return Response.json({ ok: true });
}
export async function DELETE(req) {
  const p = new URL(req.url).searchParams;
  const job = p.get('job') || '', id = parseInt(p.get('id') || '', 10);
  const u = await currentUser();
  if (!u || !job || !id || !canJob(u, job)) return no();
  const sql = await ordersDb();
  const [ex] = await sql`select author from orders where id = ${id} and job = ${job}`;
  if (!ex) return Response.json({ ok: true });
  if (ex.author !== nm(u) && !(isAdmin(u) || u.legacy)) return Response.json({ error: 'Only the person who ordered, or an admin, can remove this.' }, { status: 403 });
  await sql`delete from orders where id = ${id} and job = ${job}`;
  return Response.json({ ok: true });
}
