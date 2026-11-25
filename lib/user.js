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
  const u = await userRow(p.u);
  if (!u) return null;
  return { name: u.username, role: u.role, jobs: u.role === 'admin' ? null : Array.isArray(u.jobs) ? u.jobs : [] };
}

// TEST (Nov 24): every signed-in person may open every project, like an admin; roles (who may edit) are unchanged. To undo: tag undo-before-opentest-20261124
export const canJob = (u) => !!u;
export const canEdit = (u) => !!u && (u.role === 'admin' || u.role === 'editor');
export const isAdmin = (u) => !!u && u.role === 'admin' && !u.legacy;

// A person's row (role) is kept for 20 seconds, so the many requests of one page ask the users table once instead of every time.
const ucache = new Map();
async function userRow(name) {
  const c = ucache.get(name);
  if (c && Date.now() - c.t < 20000) return c.v;
  const sql = await db();
  const [u] = await sql`select username, role, jobs from users where username = ${name}`;
  ucache.set(name, { t: Date.now(), v: u || null });
  return u || null;
}
