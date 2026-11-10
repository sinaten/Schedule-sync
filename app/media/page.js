import { notFound } from 'next/navigation';
import { currentUser, canJob } from '../../lib/user';
import { visitsDb } from '../../lib/visits';
import MediaGrid from '../MediaGrid';
export const dynamic = 'force-dynamic';

// /media?job=<job>[&section=<id>] : photos and videos of a job (or one section). Without a job: the list of jobs that have any.
export default async function Media({ searchParams }) {
  const u = await currentUser();
  const job = String(searchParams.job || '');
  const section = String(searchParams.section || '');
  if (job) {
    if (!canJob(u, job)) notFound();
    const sql = await visitsDb();
    let name = '';
    if (section) {
      const [s] = await sql`select name from sections where id = ${section} and job = ${job}`;
      if (!s) notFound();
      name = s.name;
    }
    return (
      <main>
        <p><a href={'/j/' + encodeURIComponent(job)}>&larr; {job}</a></p>
        <h1>Photos &amp; videos{name ? ' – ' + name : ''}</h1>
        <MediaGrid job={job} section={section || undefined} />
      </main>
    );
  }
  const sql = await visitsDb();
  const rows = await sql`select v.job, count(m.id)::int as files from visits v join media m on m.visit_id = v.id group by v.job order by v.job`;
  const jobs = rows.filter((r) => canJob(u, r.job));
  return (
    <main>
      <h1>Photos &amp; videos</h1>
      {!jobs.length && <p className="muted">Nothing saved yet.</p>}
      <ul>
        {jobs.map((r) => (
          <li key={r.job}><a href={'/media?job=' + encodeURIComponent(r.job)}>{r.job}</a> <span className="muted">({r.files})</span></li>
        ))}
      </ul>
    </main>
  );
}
