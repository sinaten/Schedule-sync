import { currentUser, canJob, canEdit } from '../../../lib/user';
import { followDb, BARS } from '../../../lib/followup';
export const dynamic = 'force-dynamic';
const nm = (u) => (u && u.name) || 'admin';
const no = () => Response.json({ error: 'No access' }, { status: 403 });

// All items of the job's Follow-up bars.
export async function GET(req) {
  const job = new URL(req.url).searchParams.get('job') || '';
  const u = await currentUser();
  if (!u || !job || !canJob(u, job)) return no();
  const sql = await followDb();
  const items = await sql`select id, bar, body, author, created_at from followup_items where job = ${job} order by created_at, id`;
  return Response.json({ me: nm(u), can: canEdit(u), items });
}

// Add an item to a bar.
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || ''), bar = String(b.bar || ''), text = String(b.text || '').trim().slice(0, 2000);
  const u = await currentUser();
  if (!u || !job || !canJob(u, job)) return no();
  if (!BARS.includes(bar) || !text) return Response.json({ error: 'Bad item' }, { status: 400 });
  const sql = await followDb();
  const [r] = await sql`insert into followup_items(job, bar, body, author) values(${job}, ${bar}, ${text}, ${nm(u)}) returning id`;
  return Response.json({ ok: true, id: r.id });
}

// Remove an item: its author, an editor or a manager.
export async function DELETE(req) {
  const p = new URL(req.url).searchParams;
  const job = p.get('job') || '', id = parseInt(p.get('id') || '', 10);
  const u = await currentUser();
  if (!u || !job || !id || !canJob(u, job)) return no();
  const sql = await followDb();
  const [ex] = await sql`select author from followup_items where id = ${id} and job = ${job}`;
  if (!ex) return Response.json({ ok: true });
  if (ex.author && ex.author !== nm(u) && !canEdit(u)) return Response.json({ error: 'Only the author, an editor or a manager can remove this' }, { status: 403 });
  await sql`delete from followup_items where id = ${id} and job = ${job}`;
  return Response.json({ ok: true });
}
