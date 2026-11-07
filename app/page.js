import { db } from '../lib/db';
import Viewer3D from './Viewer3D';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const when = (d) => new Date(d).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
export default async function Home() {
  const sql = await db();
  const list = await sql`select s.id, s.name, s.updated_at,
    (select count(*) from rows r where r.schedule_id=s.id)::int as n,
    (select count(*) from edits e where e.schedule_id=s.id and e.status='pending')::int as p
    from schedules s order by s.name`;
  return (
    <main>
      <h1>Schedules</h1>
  <Viewer3D />
      {list.length === 0 && <p className="muted">No schedules yet. Run the Revit add-in and choose the schedules to watch.</p>}
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
