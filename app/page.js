import { db } from '../lib/db';
import JobList from './JobList';
import { currentUser, isAdmin } from '../lib/user';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
// Each Revit project has a job number (for example "8745 CLT"). The home page lists the jobs; a job page shows its 3D model and schedules.
export default async function Home() {
  const u = await currentUser();
  const sql = await db();
  const sched = await sql`select coalesce(job,'') as job, count(*)::int as n from schedules group by 1`;
  const models = await sql`select case when key='model' then '' else substr(key, 7) end as job from settings where key='model' or key like 'model:%'`;
  const map = new Map();
  for (const s of sched) map.set(s.job, { slug: s.job || '_none', label: s.job || 'No job number yet', n: s.n, model: false });
  for (const m of models) {
    const j = map.get(m.job) || { slug: m.job || '_none', label: m.job || 'No job number yet', n: 0, model: false };
    j.model = true;
    map.set(m.job, j);
  }
  const jobs = [...map.entries()].filter(([k]) => !u || u.jobs === null || (k !== '' && u.jobs.includes(k))).map(([, x]) => x).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return (
    <main>
      <h1>Jobs</h1>
      <JobList jobs={jobs} admin={isAdmin(u)} />
    </main>
  );
}
