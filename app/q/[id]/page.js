import { notFound } from 'next/navigation';
import { db } from '../../../lib/db';
import { currentUser, canJob } from '../../../lib/user';
export const dynamic = 'force-dynamic';

// Landing page for a section QR code.
export default async function Section({ params }) {
  const u = await currentUser();
  const sql = await db();
  await sql`create table if not exists sections(id text primary key, job text not null, name text not null, pos int default 0, created_at timestamptz default now())`;
  const [s] = await sql`select id, job, name from sections where id = ${params.id}`;
  if (!s || !canJob(u, s.job)) notFound();
  return (
    <main>
      <p className="muted" style={{ margin: 0 }}>Job</p>
      <h1 style={{ marginTop: 0 }}>{s.job}</h1>
      <p className="muted" style={{ margin: 0 }}>Section</p>
      <h2 style={{ marginTop: 0 }}>{s.name}</h2>
      <p><a href={'/capture?s=' + s.id}>Take photos or video for this section</a></p>
      <p className="muted">Saving photos and video to this section is the next step and is not connected yet.</p>
    </main>
  );
}
