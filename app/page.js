import { db } from '../lib/db';
import HomeSites from './HomeSites';
import { currentUser } from '../lib/user';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
// Each Revit project has a job number (for example "8745 CLT"). The home page lists the jobs; a job page shows its 3D model and schedules.
export default async function Home() {
  const u = await currentUser();
  const sql = await db();
  const sched = await sql`select coalesce(job,'') as job, count(*)::int as n from schedules group by 1`;
  const models = await sql`select case when key='model' then '' else substr(key, 7) end as job from settings where key='model' or key like 'model:%'`;
  const st = await sql`select substr(key, 10) as job, value from settings where key like 'jobstate:%'`;
  const stOf = new Map(st.map((x) => [x.job, x.value || {}]));
  const map = new Map();
  for (const s of sched) map.set(s.job, { slug: s.job || '_none', label: s.job || 'No job number yet', n: s.n, model: false });
  for (const m of models) {
    const j = map.get(m.job) || { slug: m.job || '_none', label: m.job || 'No job number yet', n: 0, model: false };
    j.model = true;
    map.set(m.job, j);
  }
  for (const [k, x] of map) { const s = stOf.get(k); if (s && s.state && s.state !== 'active') { x.state = s.state; x.by = s.by || ''; } }
  const jobs = [...map.entries()].filter(([k]) => !u || u.jobs === null || (k !== '' && u.jobs.includes(k))).map(([, x]) => x).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const meta = await sql`select substr(key, 10) as job, value from settings where key like 'projmeta:%'`;
  const siteRows = await sql`select substr(key, 6) as id, value from settings where key like 'site:%'`;
  const siteOf = new Map(meta.map((m) => [m.job, (m.value && m.value.siteId) || '']));
  const sites = siteRows.map((r) => ({ id: r.id, name: (r.value && r.value.name) || 'Site', city: (r.value && r.value.city) || '', country: (r.value && r.value.country) || '', address: (r.value && r.value.address) || '', jobs: [] }));
  const byId = new Map(sites.map((x) => [x.id, x]));
  const none = { id: '', name: 'Not attached to a site', city: '', country: '', address: '', jobs: [] };
  for (const j of jobs) { const x = byId.get(siteOf.get(j.slug) || ''); const pj = { ...j, title: (stOf.get(j.slug) || {}).title || '' }; (x || none).jobs.push(pj); }
  const all = u && u.jobs !== null ? sites.filter((x) => x.jobs.length) : sites;
  all.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (none.jobs.length) all.push(none);
  return (
    <main className="wide">
      <h1>Sites</h1>
      <HomeSites sites={all} />
    </main>
  );
}
