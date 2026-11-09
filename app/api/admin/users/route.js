import { db } from '../../../../lib/db';
import { hashPw, newSalt } from '../../../../lib/auth';
import { currentUser, isAdmin } from '../../../../lib/user';
export const dynamic = 'force-dynamic';

const ROLES = ['admin', 'editor', 'viewer'];
const no = () => Response.json({ error: 'Admins only' }, { status: 403 });

// Admin page API: list, create / update, delete users.
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  const sql = await db();
  const users = await sql`select username, role, jobs, created_at from users order by username`;
  const j = await sql`select distinct job from schedules where job is not null union select substr(key, 7) from settings where key like 'model:%' order by 1`;
  return Response.json({ users, jobs: j.map((x) => x.job).filter(Boolean), owner: process.env.ADMIN_USER });
}

export async function POST(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const username = String(b.username || '').trim().slice(0, 60);
  const role = String(b.role || 'viewer');
  const jobs = Array.isArray(b.jobs) ? b.jobs.map(String).slice(0, 500) : [];
  const password = String(b.password || '');
  if (!username) return Response.json({ error: 'Username is required' }, { status: 400 });
  if (username === process.env.ADMIN_USER) return Response.json({ error: 'That name belongs to the owner account' }, { status: 400 });
  if (!ROLES.includes(role)) return Response.json({ error: 'Unknown role' }, { status: 400 });
  const sql = await db();
  const [old] = await sql`select username from users where username = ${username}`;
  if (!old && password.length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  if (password && password.length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  if (!old) {
    const salt = newSalt();
    await sql`insert into users(username, pass_hash, salt, role, jobs) values(${username}, ${await hashPw(password, salt)}, ${salt}, ${role}, ${JSON.stringify(jobs)}::jsonb)`;
  } else {
    await sql`update users set role = ${role}, jobs = ${JSON.stringify(jobs)}::jsonb where username = ${username}`;
    if (password) {
      const salt = newSalt();
      await sql`update users set salt = ${salt}, pass_hash = ${await hashPw(password, salt)} where username = ${username}`;
    }
  }
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  if (!isAdmin(await currentUser())) return no();
  const username = new URL(req.url).searchParams.get('username') || '';
  const sql = await db();
  await sql`delete from users where username = ${username}`;
  return Response.json({ ok: true });
}
