import { db } from '../../../../lib/db';
import { currentUser, isAdmin } from '../../../../lib/user';
import { getJobState, setJobState } from '../../../../lib/jobstate';
export const dynamic = 'force-dynamic';

// Admins only: GET = all jobs with their status; PUT { job, state } = set a job active / inactive (from the website); DELETE = wipe a job's data (it is then kept inactive so Revit does not build it again).
export async function GET() {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const sql = await db();
  const j = await sql`select distinct job from schedules where job is not null union select substr(key, 7) from settings where key like 'model:%' union select substr(key, 10) from settings where key like 'jobstate:%'`;
  const jobs = [];
  for (const x of j) { if (!x.job) continue; const s = await getJobState(sql, x.job); jobs.push({ job: x.job, state: s.state, by: s.by, title: s.title }); }
  jobs.sort((a, b) => a.job.localeCompare(b.job, undefined, { numeric: true }));
  return Response.json({ jobs });
}
export async function PUT(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '').trim();
  const state = String(b.state || '');
  if (!job || !['active', 'inactive'].includes(state)) return Response.json({ error: 'job and state (active, inactive) are required' }, { status: 400 });
  return Response.json({ ok: true, ...(await setJobState(await db(), job, state, 'site')) });
}

// Admins only: remove one job (its schedules, rows, edits, 3D model, colours and ticks). Photos and issues are kept.
export async function DELETE(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const raw = new URL(req.url).searchParams.get('job') || '';
  if (!raw) return Response.json({ error: 'No job' }, { status: 400 });
  const none = raw === '_none'; // the "No job number yet" entry (older files without a job number)
  const job = none ? '' : raw;
  const sql = await db();
  const ids = (await sql`select id from schedules where coalesce(job, '') = ${job}`).map((x) => x.id);
  if (ids.length) {
    await sql`delete from rows where schedule_id = any(${ids}::text[])`;
    await sql`delete from edits where schedule_id = any(${ids}::text[])`;
    await sql`delete from schedules where id = any(${ids}::text[])`;
  }
  const keys = none ? ['model', 'look', 'looks', 'ifc', 'model:', 'look:', 'looks:', 'ifc:'] : ['model:' + job, 'look:' + job, 'looks:' + job, 'ifc:' + job];
  await sql`delete from settings where key = any(${keys}::text[]) or starts_with(key, ${'layer:' + job + ':'})`;
  if (!none) await setJobState(sql, job, 'inactive', 'site'); // so Revit does not build it again
  return Response.json({ ok: true, schedules: ids.length });
}
