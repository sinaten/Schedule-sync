import { ensureFolder } from '../../../../lib/folders';
import { db, isAddin, deny } from '../../../../lib/db';
import { getJobState, setJobState, wipeJob } from '../../../../lib/jobstate';
export const dynamic = 'force-dynamic';
// The Revit add-in: GET = every job the site knows with its status (active / inactive / deleted) and who set it;
// POST { job, state, title } = Revit sets a job active / inactive / deleted (deleted also wipes the job's data on the website; a small blocked mark stays so Revit does not build it again).
export async function GET(req) {
  if (!isAddin(req)) return deny();
  const sql = await db();
  const j = await sql`select distinct job from schedules where job is not null union select substr(key, 7) from settings where key like 'model:%' union select substr(key, 10) from settings where key like 'jobstate:%'`;
  const jobs = [];
  for (const x of j) {
    if (!x.job) continue;
    const s = await getJobState(sql, x.job);
    jobs.push({ job: x.job, state: s.state, by: s.by, title: s.title });
  }
  jobs.sort((a, b) => a.job.localeCompare(b.job, undefined, { numeric: true }));
  return Response.json({ jobs });
}
export async function POST(req) {
  if (!isAddin(req)) return deny();
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '').trim();
  const state = String(b.state || '');
  if (!job || !['active', 'inactive', 'deleted'].includes(state)) return Response.json({ error: 'job and state (active, inactive, deleted) are required' }, { status: 400 });
  const sql = await db();
  if (state === 'deleted') await wipeJob(sql, job); // deleted in Revit = everything on the site is wiped too
  await ensureFolder(sql, job);
  const v = await setJobState(sql, job, state, 'revit', b.title);
  return Response.json({ ok: true, ...v });
}
