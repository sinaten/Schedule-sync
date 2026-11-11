import { isAddin, deny } from '../../../../lib/db';
import { histDb } from '../../../../lib/history';
export const dynamic = 'force-dynamic';

// Revit add-in (x-api-key): a user's History records, oldest first. ?user=NAME (required) &from=ISO &to=ISO (to is exclusive) &job=NUMBER
export async function GET(req) {
  if (!isAddin(req)) return deny();
  const p = new URL(req.url).searchParams;
  const user = p.get('user');
  if (!user) return Response.json({ error: 'user required' }, { status: 400 });
  const from = p.get('from') || null, to = p.get('to') || null, job = p.get('job') || null;
  const sql = await histDb();
  const rows = await sql`select id, taken_at, changes from history where username = ${user}
    and (${from}::timestamptz is null or taken_at >= ${from}::timestamptz)
    and (${to}::timestamptz is null or taken_at < ${to}::timestamptz)
    and (${job}::text is null or job is null or job = ${job}::text)
    order by taken_at asc, id asc limit 5000`;
  return Response.json({ rows });
}
