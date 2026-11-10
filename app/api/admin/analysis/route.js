import { currentUser, canEdit } from '../../../../lib/user';
import { db } from '../../../../lib/db';
import { visitsDb } from '../../../../lib/visits';
import { getLoc } from '../../../../lib/locrules';
export const dynamic = 'force-dynamic';

// Admin and editor: per person, how many of their photos / videos were taken near the QR location (green / orange / red) or could not be checked.
export async function GET() {
  if (!canEdit(await currentUser())) return Response.json({ error: 'Admins and editors only' }, { status: 403 });
  const lr = await getLoc();
  const sql = await visitsDb();
  const users = await sql`select username, role from users`;
  const rows = await sql`select username,
      count(*) filter (where d is null)::int as u,
      count(*) filter (where d <= ${lr.green})::int as g,
      count(*) filter (where d > ${lr.green} and d <= ${lr.orange})::int as o,
      count(*) filter (where d > ${lr.orange})::int as r
    from (select v.username, case when s.lat is not null and s.lng is not null and v.lat is not null and v.lng is not null then 2 * 6371000 * asin(sqrt(least(1, power(sin(radians(v.lat::float8 - s.lat::float8) / 2), 2) + cos(radians(s.lat::float8)) * cos(radians(v.lat::float8)) * power(sin(radians(v.lng::float8 - s.lng::float8) / 2), 2)))) end as d
      from media m join visits v on v.id = m.visit_id left join sections s on s.id = v.section_id where m.kind <> 'scan') t
    where username is not null group by username`;
  const role = {};
  for (const u of users) role[u.username] = u.role;
  const out = rows.map((r) => ({ username: r.username, role: role[r.username] || (r.username === process.env.ADMIN_USER ? 'admin' : 'user'), g: r.g, o: r.o, r: r.r, u: r.u }));
  // people with no photos yet still get a row
  for (const u of users) if (!out.find((x) => x.username === u.username)) out.push({ username: u.username, role: u.role, g: 0, o: 0, r: 0, u: 0 });
  out.sort((a, b) => a.username.localeCompare(b.username));
  return Response.json({ rows: out, green: lr.green, orange: lr.orange });
}
