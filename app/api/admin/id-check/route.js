import { currentUser, isAdmin } from '../../../../lib/user';
import { issuesDb } from '../../../../lib/issues';
export const dynamic = 'force-dynamic';

// Admins only. READ ONLY: looks at every element number the site holds and says where the same number appears twice. Nothing is changed.
export async function GET() {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const sql = await issuesDb();
  const out = { scanned: {}, sameSchedule: [], sameProjectOtherModel: [], otherProjects: { count: 0, examples: [] }, issuesAmbiguous: [], note: '' };
  const [c] = await sql`select count(*)::int as n, count(distinct r.element_id)::int as ids, count(distinct s.job)::int as jobs, count(distinct (s.job, coalesce(s.src, '')))::int as models from rows r join schedules s on s.id = r.schedule_id where s.job is not null`;
  out.scanned = { rows: c.n, elementNumbers: c.ids, projects: c.jobs, models: c.models };
  out.sameSchedule = (await sql`select s.name, s.job, r.element_id, count(*)::int as n from rows r join schedules s on s.id = r.schedule_id where s.job is not null group by s.id, s.name, s.job, r.element_id having count(*) > 1 order by n desc limit 100`).map((x) => ({ schedule: x.name, project: x.job, element: x.element_id, times: x.n }));
  out.sameProjectOtherModel = (await sql`select s.job, r.element_id, count(distinct coalesce(s.src, ''))::int as models from rows r join schedules s on s.id = r.schedule_id where s.job is not null group by s.job, r.element_id having count(distinct coalesce(s.src, '')) > 1 order by s.job, r.element_id limit 200`).map((x) => ({ project: x.job, element: x.element_id, models: x.models }));
  const oth = await sql`select r.element_id, array_agg(distinct s.job) as jobs from rows r join schedules s on s.id = r.schedule_id where s.job is not null group by r.element_id having count(distinct s.job) > 1 order by r.element_id limit 5000`;
  out.otherProjects = { count: oth.length, examples: oth.slice(0, 40).map((x) => ({ element: x.element_id, projects: x.jobs })) };
  try {
    out.issuesAmbiguous = (await sql`select i.job, i.element_id from issues i where (select count(distinct coalesce(s.src, '')) from rows r join schedules s on s.id = r.schedule_id where s.job = i.job and r.element_id = i.element_id) > 1 limit 100`).map((x) => ({ project: x.job, element: x.element_id }));
  } catch (e) { out.note = 'Issues were not checked.'; }
  return Response.json(out);
}
