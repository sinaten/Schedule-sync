// The work of one person across ALL projects, for the Home page of a regular user: open action plans that name the person (a site user),
// with a date window that is not over yet (both the start day and the end day count). Grouped by site, soonest first.
const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const day = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : '');
export async function homeWork(sql, issuesSql, name) {
  const today = nyToday();
  const rows = await issuesSql`select a.job, a.element_id, a.job_no, a.status, a.start_date, a.end_date, a.assignees, i.no as issue_no, i.description
    from action_plans a join issues i on i.job = a.job and i.element_id = a.element_id where a.status not in ('done', 'closed')`;
  const mine = [];
  for (const a of rows) {
    if (!Array.isArray(a.assignees) || !a.assignees.some((x) => x && x.u && x.n === name)) continue;
    const e = day(a.end_date), s = day(a.start_date) || e;
    if (!s) continue;
    const end = e || s;
    if (end < today) continue;
    mine.push({ job: a.job, element: a.element_id, card: 'ISS-' + String(a.issue_no || 0).padStart(4, '0'), title: String(a.description || '').split('\n')[0].slice(0, 120), start: s, end, now: s <= today && today <= end });
  }
  if (!mine.length) return { today, sites: [] };
  const jobs = [...new Set(mine.map((x) => x.job))];
  const meta = await sql`select substr(key, 10) as job, value from settings where key like 'projmeta:%'`;
  const siteRows = await sql`select substr(key, 6) as id, value from settings where key like 'site:%'`;
  const siteOf = new Map(meta.map((m) => [m.job, (m.value && m.value.siteId) || '']));
  const siteBy = new Map(siteRows.map((r) => [r.id, r.value || {}]));
  const g = new Map();
  for (const c of mine) {
    const sid = siteOf.get(c.job) || '';
    const sv = siteBy.get(sid) || {};
    const key = sid || '_none';
    const x = g.get(key) || { id: key, name: sv.name || 'Site', place: [sv.city, sv.country].filter(Boolean).join(', '), cards: [] };
    x.cards.push(c);
    g.set(key, x);
  }
  const sites = [...g.values()].map((x) => {
    x.cards.sort((a, b) => a.start.localeCompare(b.start));
    x.now = x.cards.some((c) => c.now);
    x.start = x.cards[0].start;
    x.end = x.cards.reduce((m, c) => (c.end > m ? c.end : m), '');
    x.projects = [...new Set(x.cards.map((c) => c.job))];
    return x;
  }).sort((a, b) => (a.now === b.now ? a.start.localeCompare(b.start) : a.now ? -1 : 1));
  return { today, sites };
}
