import { isAddin, deny } from '../../../../lib/db';
import { histDb } from '../../../../lib/history';
export const dynamic = 'force-dynamic';

// Revit add-in (x-api-key): History records, oldest first. ?user=NAME (required; "*" = every user) &from=ISO &to=ISO (to is exclusive) &job=NUMBER
export async function GET(req) {
  if (!isAddin(req)) return deny();
  const p = new URL(req.url).searchParams;
  let user = p.get('user');
  if (!user) return Response.json({ error: 'user required' }, { status: 400 });
  if (user === '*') user = null;
  const from = p.get('from') || null, to = p.get('to') || null, job = p.get('job') || null;
  const sql = await histDb();
  const rows = await sql`select id, username, taken_at, changes from history where (${user}::text is null or username = ${user}::text)
    and (${from}::timestamptz is null or taken_at >= ${from}::timestamptz)
    and (${to}::timestamptz is null or taken_at < ${to}::timestamptz)
    and (${job}::text is null or job is null or job = ${job}::text)
    order by taken_at asc, id asc limit 5000`;
  return Response.json({ rows });
}
