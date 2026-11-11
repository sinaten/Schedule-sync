import { isAddin, deny, db } from '../../../../lib/db';
import { getColPerms } from '../../../../lib/colperms';
export const dynamic = 'force-dynamic';

// Revit add-in (x-api-key): which Yes/No columns each user may change on the website.
// GET -> { users, columns (every Yes/No column of the schedules sent from Revit), perms: { user: [column] } }
export async function GET(req) {
  if (!isAddin(req)) return deny();
  const sql = await db();
  const users = await sql`select username from users where role <> 'admin' order by username`;
  const sch = await sql`select columns from schedules`;
  const cols = new Set();
  for (const s of sch) for (const c of Array.isArray(s.columns) ? s.columns : []) if (c && c.type === 'bool' && !c.readOnly && c.name) cols.add(c.name);
  return Response.json({ users: users.map((u) => u.username), columns: [...cols].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), perms: await getColPerms() });
}

// POST { username, columns: [name] } -> that user may change exactly these columns (empty list = none)
export async function POST(req) {
  if (!isAddin(req)) return deny();
  const b = await req.json().catch(() => ({}));
  const username = String((b && b.username) || '').trim();
  const columns = Array.isArray(b && b.columns) ? b.columns.map((x) => String(x)).slice(0, 500) : [];
  if (!username) return Response.json({ error: 'username required' }, { status: 400 });
  const sql = await db();
  const [u] = await sql`select username from users where username = ${username}`;
  if (!u) return Response.json({ error: 'Unknown user' }, { status: 400 });
  const all = await getColPerms();
  all[username] = columns;
  await sql`insert into settings(key, value) values('col_perms', ${JSON.stringify(all)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true });
}
