import { db } from '../../../../lib/db';
import { currentUser, isAdmin } from '../../../../lib/user';
import { getJobState } from '../../../../lib/jobstate';
export const dynamic = 'force-dynamic';

// Admins only: one folder per Revit job with its models and schedules, as Revit last sent them.
export async function GET() {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const sql = await db();
  const names = await sql`select distinct job as j from schedules where job is not null union select substr(key, 7) from settings where key like 'model:%' union select substr(key, 10) from settings where key like 'jobstate:%' union select substr(key, 10) from settings where key like 'projmeta:%'`;
  const sch = await sql`select s.id, s.name, s.job, s.updated_at, (select count(*)::int from rows r where r.schedule_id = s.id) as n from schedules s where s.job is not null`;
  const mods = await sql`select substr(key, 7) as job, value from settings where key like 'model:%'`;
  const metas = await sql`select substr(key, 10) as job, value from settings where key like 'projmeta:%'`;
  const sites = await sql`select key, value from settings where key like 'site:%'`;
  const siteName = Object.fromEntries(sites.map((r) => [r.key.slice(5), (r.value && r.value.name) || '']));
  const folders = [];
  for (const x of names) {
    const job = x.j; if (!job) continue;
    const st = await getJobState(sql, job);
    const m = mods.find((r) => r.job === job); const meta = metas.find((r) => r.job === job);
    const siteId = (meta && meta.value && meta.value.siteId) || '';
    folders.push({
      job, state: st.state, by: st.by, title: st.title,
      siteId, site: siteId ? siteName[siteId] || '' : '',
      models: m && m.value && m.value.urn ? [{ name: m.value.name || 'Model', at: m.value.uploadedAt || '' }] : [],
      schedules: sch.filter((r) => r.job === job).map((r) => ({ id: r.id, name: r.name, rows: r.n, at: r.updated_at })).sort((a, b) => String(a.name).localeCompare(String(b.name))),
    });
  }
  folders.sort((a, b) => a.job.localeCompare(b.job, undefined, { numeric: true }));
  return Response.json({ folders });
}
