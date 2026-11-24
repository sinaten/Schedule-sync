import { currentUser, canJob } from '../../../lib/user';
import { issuesDb, cardNo, jobNo } from '../../../lib/issues';
export const dynamic = 'force-dynamic';

// GET ?job=X&d=YYYY-MM-DD (the person's own today): the action plans assigned to this person, open ones only.
// A plan belongs to every day from its start date to its end date, both days included. Missing start = end date only; missing both = not planned (not shown).
// today / tomorrow: plans that cover that day. next: when nothing is due today, the plan that starts soonest after today.
const day = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : '');
const plus1 = (s) => { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const job = p.get('job') || '', today = day(p.get('d'));
  const u = await currentUser();
  if (!u || !job || !today || !canJob(u, job)) return Response.json({ error: 'No access' }, { status: 403 });
  const me = (u && u.name) || '';
  const sql = await issuesDb();
  const rows = await sql`select a.element_id, a.no, a.job_no, a.body, a.status, a.assignees, a.start_date, a.end_date, i.no as issue_no, i.description
    from action_plans a join issues i on i.job = a.job and i.element_id = a.element_id
    where a.job = ${job} and a.status not in ('done', 'closed')`;
  const tomorrow = plus1(today);
  const mine = rows.filter((a) => me && Array.isArray(a.assignees) && a.assignees.some((x) => x && x.u && x.n === me)).map((a) => {
    const e = day(a.end_date), s = day(a.start_date) || e;
    return { element_id: a.element_id, jobNo: a.job_no || jobNo(a.no), card: cardNo(a.issue_no), title: String(a.description || '').split('\n')[0].slice(0, 120), how: String(a.body || '').slice(0, 160), status: a.status, start: s, end: e || s };
  }).filter((a) => a.start);
  const cover = (a, d) => a.start <= d && d <= a.end;
  const t0 = mine.filter((a) => cover(a, today)), t1 = mine.filter((a) => cover(a, tomorrow));
  const later = mine.filter((a) => a.start > tomorrow).sort((a, b) => a.start.localeCompare(b.start));
  const next = t0.length ? null : (t1.length ? null : later[0] || null);
  return Response.json({ today: t0, tomorrow: t1, next });
}
