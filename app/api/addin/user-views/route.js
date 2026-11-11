import { isAddin, deny, db } from '../../../../lib/db';
export const dynamic = 'force-dynamic';

// Revit add-in (x-api-key): the site's users (not admins), and which 3D view each user was given per job.
// Stored in settings key 'user_views' as { [job]: { [username]: viewName } }.
async function load(sql) {
  const [r] = await sql`select value from settings where key = 'user_views'`;
  return (r && r.value) || {};
}

export async function GET(req) {
  if (!isAddin(req)) return deny();
  const sql = await db();
  const users = await sql`select username, role from users where role <> 'admin' order by username`;
  return Response.json({ users: users.map((u) => u.username), views: await load(sql) });
}

export async function POST(req) {
  if (!isAddin(req)) return deny();
  const b = await req.json().catch(() => ({}));
  const job = String((b && b.job) || '').trim();
  const username = String((b && b.username) || '').trim();
  const view = String((b && b.view) || '').trim();
  if (!job || !username) return Response.json({ error: 'job and username required' }, { status: 400 });
  const sql = await db();
  const [u] = await sql`select username from users where username = ${username}`;
  if (!u) return Response.json({ error: 'Unknown user' }, { status: 400 });
  const all = await load(sql);
  all[job] = all[job] || {};
  if (view) all[job][username] = view; else delete all[job][username];
  await sql`insert into settings(key, value) values('user_views', ${JSON.stringify(all)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true });
}
