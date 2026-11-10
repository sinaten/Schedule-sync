import { notFound, redirect } from 'next/navigation';
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
  redirect('/capture?s=' + s.id);
}
