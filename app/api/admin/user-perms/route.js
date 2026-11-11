import { currentUser, isAdmin } from '../../../../lib/user';
import { db } from '../../../../lib/db';
import { getPerms, PERMS } from '../../../../lib/perms';
export const dynamic = 'force-dynamic';

const no = () => Response.json({ error: 'Admins only' }, { status: 403 });

// Admin: per-user permissions (who may do what). Ticked = allowed.
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  const sql = await db();
  const users = await sql`select username, role from users order by username`;
  return Response.json({ perms: PERMS.map(([k, label]) => ({ key: k, label })), users: users.filter((u) => u.role !== 'admin'), values: await getPerms() });
}

export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const sql = await db();
  const users = await sql`select username from users`;
  const ok = new Set(users.map((u) => u.username));
  const out = {};
  for (const [name, p] of Object.entries(b || {})) {
    if (!ok.has(name)) continue;
    out[name] = {};
    for (const [k] of PERMS) out[name][k] = !!(p && p[k]);
  }
  await sql`insert into settings(key, value) values('user_perms', ${JSON.stringify(out)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true });
}
