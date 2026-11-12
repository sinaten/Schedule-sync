import { del } from '@vercel/blob';
import { currentUser, canJob, isAdmin } from '../../../lib/user';
import { issuesDb } from '../../../lib/issues';
export const dynamic = 'force-dynamic';
const nm = (u) => (u && u.name) || 'admin';
const no = () => Response.json({ error: 'No access' }, { status: 403 });

// One issue per part: description, who raised it and when, plus its comments, photos and files.
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const job = p.get('job') || '', el = p.get('element') || '';
  const u = await currentUser();
  if (!u || !job || !el || !canJob(u, job)) return no();
  const sql = await issuesDb();
  const [issue] = await sql`select description, author, created_at from issues where job = ${job} and element_id = ${el}`;
  const items = await sql`select id, kind, author, body, pathname, name, content_type, created_at from issue_items where job = ${job} and element_id = ${el} order by id`;
  return Response.json({ me: nm(u), issue: issue || null, items });
}

// action "comment": add a chat message. Otherwise: save the description.
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || ''), el = String(b.element || '');
  const u = await currentUser();
  if (!u || !job || !el || !canJob(u, job)) return no();
  const sql = await issuesDb();
  if (b.action === 'link') {
    // a photo taken in the camera flow (it also lives in the user's album)
    const [m] = await sql`select pathname from media where pathname = ${String(b.pathname || '')}`;
    if (!m) return Response.json({ error: 'Unknown photo' }, { status: 400 });
    await sql`insert into issue_items(job, element_id, kind, author, name, pathname, content_type) values(${job}, ${el}, ${b.kind === 'video' ? 'video' : 'photo'}, ${nm(u)}, ${String(b.name || 'photo.jpg')}, ${m.pathname}, ${String(b.contentType || (b.kind === 'video' ? 'video/mp4' : 'image/jpeg'))})`;
    return Response.json({ ok: true });
  }
  if (b.action === 'comment') {
    const body = String(b.body || '').trim().slice(0, 2000);
    if (!body) return Response.json({ error: 'Empty comment' }, { status: 400 });
    await sql`insert into issue_items(job, element_id, kind, author, body) values(${job}, ${el}, 'comment', ${nm(u)}, ${body})`;
    return Response.json({ ok: true });
  }
  const d = String(b.description ?? '').slice(0, 5000);
  const [ex] = await sql`select author from issues where job = ${job} and element_id = ${el}`;
  if (ex && ex.author && ex.author !== nm(u) && !isAdmin(u)) return Response.json({ error: 'Only the author can change the issue text' }, { status: 403 });
  await sql`insert into issues(job, element_id, description, author) values(${job}, ${el}, ${d}, ${nm(u)})
    on conflict (job, element_id) do update set description = excluded.description, updated_at = now()`;
  return Response.json({ ok: true });
}

// Delete one comment, photo or file: its author or an admin.
export async function DELETE(req) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  const u = await currentUser();
  if (!u || !id) return no();
  const sql = await issuesDb();
  const [it] = await sql`select id, job, author, pathname from issue_items where id = ${id}`;
  if (!it || !canJob(u, it.job) || (it.author !== nm(u) && !isAdmin(u))) return no();
  if (it.pathname && it.pathname.startsWith('issues/')) { try { await del(it.pathname); } catch (e) {} }
  await sql`delete from issue_items where id = ${id}`;
  return Response.json({ ok: true });
}
