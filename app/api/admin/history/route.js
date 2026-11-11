import { currentUser, isAdmin } from '../../../../lib/user';
import { histDb } from '../../../../lib/history';
export const dynamic = 'force-dynamic';

// Admin: the users (everyone except admins) and, for ?user=NAME, that person's History records, newest first.
export async function GET(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const sql = await histDb();
  const user = new URL(req.url).searchParams.get('user');
  if (user) {
    const rows = await sql`select id, taken_at, lat, lng, changes from history where username = ${user} order by taken_at desc limit 200`;
    return Response.json({ rows });
  }
  const users = await sql`select u.username, u.role, (select count(*)::int from history h where h.username = u.username) as n, (select max(taken_at) from history h where h.username = u.username) as last from users u where u.role <> 'admin' order by u.username`;
  return Response.json({ users });
}
