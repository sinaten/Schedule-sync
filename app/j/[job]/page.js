import { db } from '../../../lib/db';
import Viewer3D from '../../Viewer3D';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const when = (d) => new Date(d).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
export default async function JobPage({ params }) {
  const slug = decodeURIComponent(params.job);
  const job = slug === '_none' ? '' : slug;
  const sql = await db();
  const list = job
    ? await sql`select s.id, s.name, s.updated_at,
        (select count(*) from rows r where r.schedule_id=s.id)::int as n,
        (select count(*) from edits e where e.schedule_id=s.id and e.status='pending')::int as p
        from schedules s where s.job = ${job} order by s.name`
    : await sql`select s.id, s.name, s.updated_at,
        (select count(*) from rows r where r.schedule_id=s.id)::int as n,
        (select count(*) from edits e where e.schedule_id=s.id and e.status='pending')::int as p
        from schedules s where s.job is null order by s.name`;
  return (
    <main>
      <p><a href="/">All jobs</a></p>
      <h1>{job || 'No job number yet'}</h1>
      <Viewer3D job={job} />
      {list.length === 0 && <p className="muted">No schedules for this job yet.</p>}
      <ul className="list">
        {list.map((s) => (
          <li key={s.id}>
            <a href={`/s/${encodeURIComponent(s.id)}`}>{s.name}</a>
            <span className="muted">{s.n} elements · updated {when(s.updated_at)}</span>
            {s.p > 0 && <span className="tag">{s.p} waiting for Revit</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
