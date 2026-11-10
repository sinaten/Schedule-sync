import { currentUser, canJob } from '../../../lib/user';
import { visitsDb, safe, stamp } from '../../../lib/visits';
export const dynamic = 'force-dynamic';

const need = () => Response.json({ error: 'Login required' }, { status: 401 });

// GET ?section=<id>  -> that section (job + name) if the user may use it
// GET                -> jobs and sections the user may capture for (manual mode)
export async function GET(req) {
  const u = await currentUser();
  if (!u) return need();
  const sql = await visitsDb();
  const q = new URL(req.url).searchParams;
  if (q.get('section')) {
    const [s] = await sql`select id, job, name from sections where id = ${q.get('section')}`;
    if (!s || !canJob(u, s.job)) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ section: s });
  }
  const secs = await sql`select id, job, name from sections order by job, pos, created_at`;
  const jr = await sql`select distinct job from schedules where job is not null union select job from sections order by 1`;
  const jobs = jr.map((x) => x.job).filter(Boolean).filter((j) => canJob(u, j));
  return Response.json({ jobs, sections: secs.filter((s) => canJob(u, s.job)) });
}

// Start a visit (one folder per capture session): { sectionId } or { job, sectionId? }, plus optional { lat, lng, acc }.
export async function POST(req) {
  const u = await currentUser();
  if (!u) return need();
  const b = await req.json().catch(() => ({}));
  const sql = await visitsDb();
  let job = String(b.job || '').trim();
  let sid = null;
  let sname = 'unassigned';
  if (b.sectionId) {
    const [s] = await sql`select id, job, name from sections where id = ${String(b.sectionId)}`;
    if (!s) return Response.json({ error: 'Section not found' }, { status: 404 });
    job = s.job; sid = s.id; sname = s.name;
  }
  if (!job || !canJob(u, job)) return Response.json({ error: 'No access to this job' }, { status: 403 });
  const num = (x) => (Number.isFinite(Number(x)) && x !== null && x !== '' && x !== undefined ? Number(x) : null);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const folder = [safe(job), safe(sname), stamp() + '_' + safe(u.name || 'user') + '_' + id.slice(0, 4)].join('/');
  await sql`insert into visits(id, job, section_id, section_name, folder, username, lat, lng, acc) values(${id}, ${job}, ${sid}, ${sname}, ${folder}, ${u.name || ''}, ${num(b.lat)}, ${num(b.lng)}, ${num(b.acc)})`;
  return Response.json({ id, folder, job, sectionName: sname });
}
