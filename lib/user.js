import { cookies } from 'next/headers';
import { db } from './db';
import { authOn, readToken } from './auth';

// The signed-in user: { name, role: 'admin' | 'editor' | 'viewer', jobs: null (= all) | [job numbers] }, or null.
// Before logins are set up (no ADMIN_USER / ADMIN_PASSWORD in Vercel) everyone counts as admin with legacy: true, and the old site password still guards changes.
export async function currentUser() {
  if (!authOn()) return { name: '', role: 'admin', jobs: null, legacy: true };
  const p = await readToken(cookies().get('ss')?.value);
  if (!p) return null;
  if (p.u === process.env.ADMIN_USER) return { name: p.u, role: 'admin', jobs: null };
  const sql = await db();
  const [u] = await sql`select username, role, jobs from users where username = ${p.u}`;
  if (!u) return null;
  const jobs = u.role === 'admin' ? null : Array.isArray(u.jobs) ? u.jobs : [];
  return { name: u.username, role: u.role, jobs, guest: [] }; // temporary guest access is switched off: only the access given in Admin counts (guestJobs below is not used)
}

// Guest access: a person who is assigned (as a site user) to an open action plan may LOOK at that project (read only) on the days of the plan
// (start day to end day, both included; no end day = the start day only). It ends by itself when the window is over. Writes never use it.
// Kept for 30 seconds per person so it costs one small query now and then.
const gcache = new Map();
const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
async function guestJobs(sql, name) {
  const c = gcache.get(name);
  if (c && Date.now() - c.t < 30000) return c.v;
  let v = [];
  try {
    const d = nyToday();
    const rows = await sql`select distinct job from action_plans where status not in ('done', 'closed') and assignees @> ${JSON.stringify([{ n: name, u: 1 }])}::jsonb
      and coalesce(start_date, '') <> '' and start_date <= ${d} and coalesce(nullif(end_date, ''), start_date) >= ${d}`;
    v = rows.map((r) => r.job);
  } catch (e) { v = []; }
  gcache.set(name, { t: Date.now(), v });
  return v;
}

export const canJob = (u, job) => !!u && (u.jobs === null || (!!job && u.jobs.includes(job)));
export const canEdit = (u) => !!u && (u.role === 'admin' || u.role === 'editor');
export const isAdmin = (u) => !!u && u.role === 'admin' && !u.legacy;

// To LOOK at a job (read only places): the normal access, or a guest window. Never use this where something is saved.
export const canSee = (u, job) => canJob(u, job) || (!!u && !!job && Array.isArray(u.guest) && u.guest.includes(job));
export const isGuest = (u, job) => !!u && !canJob(u, job) && canSee(u, job);
