import { randomBytes } from 'node:crypto';
import { currentUser, isAdmin } from '../../../../lib/user';
import { db, hashKey } from '../../../../lib/db';
export const dynamic = 'force-dynamic';
const no = () => Response.json({ error: 'Admins only' }, { status: 403 });

// Admins only. Followers = add-ins of other people that follow this site (read only, own key each).
// GET = list. POST { name } = new follower, returns its key ONCE. PATCH { id, active } = connect / disconnect. PATCH { id, rename }.
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  const sql = await db();
  const rows = await sql`select id, name, active, created_at, last_seen from followers order by id`;
  return Response.json({ followers: rows });
}
export async function POST(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const name = String((b && b.name) || '').trim().slice(0, 60);
  if (!name) return Response.json({ error: 'Write a name first' }, { status: 400 });
  const sql = await db();
  const [dup] = await sql`select id from followers where lower(name) = lower(${name})`;
  if (dup) return Response.json({ error: 'That name is already used' }, { status: 409 });
  const key = 'fk_' + randomBytes(24).toString('hex');
  const [r] = await sql`insert into followers(name, key_hash) values(${name}, ${hashKey(key)}) returning id`;
  return Response.json({ ok: true, id: r.id, name, key });
}
export async function PATCH(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const id = Number(b && b.id);
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
  const sql = await db();
  if (typeof b.active === 'boolean') await sql`update followers set active = ${b.active} where id = ${id}`;
  if (typeof b.rename === 'string' && b.rename.trim()) await sql`update followers set name = ${b.rename.trim().slice(0, 60)} where id = ${id}`;
  return Response.json({ ok: true });
}
