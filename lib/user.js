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
  return { name: u.username, role: u.role, jobs: u.role === 'admin' ? null : Array.isArray(u.jobs) ? u.jobs : [] };
}

export const canJob = (u, job) => !!u && (u.jobs === null || (!!job && u.jobs.includes(job)));
export const canEdit = (u) => !!u && (u.role === 'admin' || u.role === 'editor');
export const isAdmin = (u) => !!u && u.role === 'admin' && !u.legacy;
