import { del } from '@vercel/blob';
import { currentUser, canJob, canEdit, isAdmin } from '../../../lib/user';
import { getColPerms, allowedCols } from '../../../lib/colperms';
import { db } from '../../../lib/db';
import { issuesDb, STATUSES, PRIORITIES, cardNo, jobNo } from '../../../lib/issues';
export const dynamic = 'force-dynamic';
const nm = (u) => (u && u.name) || 'admin';
const nk = (x) => String(x ?? '').toLowerCase().replace(/[\s\-_]/g, '');
const isMine = (ap, u) => !!ap && (Array.isArray(ap.assignees) ? ap.assignees : []).some((a) => a && a.u && a.n === nm(u));
// an action plan is seen by managers and editors, and by the people it is assigned to
const canSeeAp = (ap, u) => canEdit(u) || isMine(ap, u);
const no = () => Response.json({ error: 'No access' }, { status: 403 });

// One issue per part: description, who raised it and when, plus its comments, photos and files.
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const job = p.get('job') || '', el = p.get('element') || '';
  const u = await currentUser();
  if (!u || !job || !canJob(u, job)) return no();
  const sql = await issuesDb();
  if (p.get('users')) {
    // people who can be given an action plan: the users of the site that may open this job
    if (!canEdit(u)) return no();
    const d = await db();
    const us = await d`select username, role, jobs from users order by username`;
    // every user of the site; access = may open this job (someone without access would not see the action plan)
    const list = us.map((x) => ({ n: x.username, role: x.role, access: x.role === 'admin' || (Array.isArray(x.jobs) && x.jobs.includes(job)) }));
    if (process.env.ADMIN_USER && !list.some((x) => x.n === process.env.ADMIN_USER)) list.unshift({ n: process.env.ADMIN_USER, role: 'admin', access: true });
    return Response.json({ users: list });
  }
  if (p.get('weather')) {
    // the forecast at the project's place: the HSE location first, else the saved location of its sections. Main source: the US National Weather Service (with official warnings); Open-Meteo is the backup.
    const d = await db();
    let lat = null, lng = null, place = '';
    try { const [h] = await d`select data from hse_profile where job = ${job}`; if (h && h.data && Number.isFinite(Number(h.data.lat)) && Number.isFinite(Number(h.data.lng)) && h.data.lat !== '') { lat = Number(h.data.lat); lng = Number(h.data.lng); place = h.data.place || ''; } } catch (e) {}
    if (lat === null) {
      const pts = await d`select lat, lng from sections where job = ${job} and lat is not null and lng is not null`;
      if (!pts.length) return Response.json({ none: true });
      lat = pts.reduce((a, x) => a + Number(x.lat), 0) / pts.length; lng = pts.reduce((a, x) => a + Number(x.lng), 0) / pts.length;
    }
    const grade = (o) => {
      const why = []; let level = 'ok';
      if (o.wet || o.rain >= 0.02 || o.snow > 0 || o.prob >= 50) { level = 'no'; why.push(o.snowy ? 'snow' : o.storm ? 'thunderstorm' : 'rain'); }
      else if (o.prob >= 25) { level = 'caution'; why.push('chance of rain ' + o.prob + '%'); }
      if (o.gust >= 30) { if (level === 'ok') level = 'caution'; why.push('wind gusts ' + Math.round(o.gust) + ' mph'); }
      if (o.hi >= 90) { if (level === 'ok') level = 'caution'; why.push('hot, ' + Math.round(o.hi) + ' F'); }
      if (o.lo <= 32) { if (level === 'ok') level = 'caution'; why.push('freezing, ' + Math.round(o.lo) + ' F'); }
      return { level, why };
    };
    let days = null, alerts = [], source = '';
    try {
      const H = { headers: { 'user-agent': 'ScheduleSync weather', accept: 'application/geo+json' }, cache: 'no-store' };
      const pt = await fetch('https://api.weather.gov/points/' + lat.toFixed(4) + ',' + lng.toFixed(4), H);
      if (!pt.ok) throw new Error('nws points ' + pt.status);
      const pj = (await pt.json()).properties;
      if (!place && pj.relativeLocation) place = pj.relativeLocation.properties.city + ', ' + pj.relativeLocation.properties.state;
      const fr = await fetch(pj.forecast, H);
      if (!fr.ok) throw new Error('nws forecast ' + fr.status);
      const per = (await fr.json()).properties.periods;
      const by = {};
      per.forEach((x) => {
        const k = x.startTime.slice(0, 10);
        const o = by[k] || (by[k] = { hi: -999, lo: 999, prob: 0, gust: 0, wet: false, snowy: false, storm: false, rain: 0, snow: 0, code: 0 });
        o.hi = Math.max(o.hi, x.temperature); o.lo = Math.min(o.lo, x.temperature);
        o.prob = Math.max(o.prob, (x.probabilityOfPrecipitation && x.probabilityOfPrecipitation.value) || 0);
        (String(x.windSpeed).match(/\d+/g) || []).forEach((n) => { o.gust = Math.max(o.gust, Number(n)); });
        const t = String(x.shortForecast);
        if (/rain|shower|drizzle|sleet|snow|thunder|flurr|ice/i.test(t) && o.prob >= 30) o.wet = true;
        if (/snow|flurr|sleet|ice/i.test(t)) o.snowy = true;
        if (/thunder/i.test(t)) o.storm = true;
        o.code = /thunder/i.test(t) ? 95 : /snow|flurr|sleet/i.test(t) ? 71 : /rain|shower|drizzle/i.test(t) ? 61 : /fog/i.test(t) ? 45 : /cloud|overcast/i.test(t) ? 3 : /partly|mostly sunny/i.test(t) ? 2 : 0;
      });
      days = Object.keys(by).sort().slice(0, 6).map((k) => { const o = by[k]; if (o.lo === 999) o.lo = o.hi; const g = grade(o); return { date: k, code: o.code, hi: o.hi, lo: o.lo, prob: o.prob, rain: 0, snow: 0, gust: Math.round(o.gust), level: g.level, why: g.why }; });
      source = 'National Weather Service';
      try {
        const ar = await fetch('https://api.weather.gov/alerts/active?point=' + lat.toFixed(4) + ',' + lng.toFixed(4), H);
        if (ar.ok) alerts = ((await ar.json()).features || []).slice(0, 6).map((f) => ({ event: f.properties.event, severity: f.properties.severity, headline: f.properties.headline, ends: f.properties.ends || f.properties.expires }));
      } catch (e) {}
      if (alerts.length && days.length) {
        const bad = alerts.some((a) => a.severity === 'Severe' || a.severity === 'Extreme');
        days.slice(0, 2).forEach((x) => { if (bad) { x.level = 'no'; } else if (x.level === 'ok') x.level = 'caution'; x.why.push('official warning: ' + alerts[0].event); });
      }
    } catch (e) { days = null; }
    if (!days) {
      try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(4) + '&longitude=' + lng.toFixed(4) + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,snowfall_sum,wind_gusts_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=6';
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error('weather ' + r.status);
        const w = (await r.json()).daily;
        days = w.time.map((t, i) => {
          const code = w.weather_code[i];
          const o = { wet: (code >= 51 && code <= 67) || (code >= 71 && code <= 77) || (code >= 80 && code <= 99), snowy: (code >= 71 && code <= 77) || code === 85 || code === 86 || (w.snowfall_sum[i] || 0) > 0, storm: code >= 95, prob: w.precipitation_probability_max[i] || 0, rain: w.precipitation_sum[i] || 0, snow: w.snowfall_sum[i] || 0, gust: w.wind_gusts_10m_max[i] || 0, hi: w.temperature_2m_max[i], lo: w.temperature_2m_min[i] };
          const g = grade(o);
          return { date: t, code, hi: Math.round(o.hi), lo: Math.round(o.lo), prob: o.prob, rain: o.rain, snow: o.snow, gust: Math.round(o.gust), level: g.level, why: g.why };
        });
        source = 'Open-Meteo (backup)';
      } catch (e) { return Response.json({ error: 'Could not get the forecast' }); }
    }
    return Response.json({ lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)), place, source, alerts, days });
  }
  if (p.get('aps')) {
    // the action plans this person may see (all for managers and editors, only the assigned ones for the others), newest first
    const aps = await sql`select a.element_id, a.no, a.body, a.status, a.assignees, a.author, a.created_at, a.updated_at, a.updated_by, a.job_no, i.no as issue_no, i.description, i.priority,
      (select count(*)::int from issue_items t where t.job = a.job and t.element_id = a.element_id and t.scope = 'ap' and t.kind = 'file') as files,
      (select count(*)::int from issue_items t where t.job = a.job and t.element_id = a.element_id and t.scope = 'ap' and t.kind in ('photo','video')) as photos,
      (select count(*)::int from issue_items t where t.job = a.job and t.element_id = a.element_id and t.scope = 'issue' and (t.kind in ('comment','chat') or (t.kind = 'photo' and t.body = 'chat'))) as i_comments,
      (select count(*)::int from issue_items t where t.job = a.job and t.element_id = a.element_id and t.scope = 'issue' and t.kind = 'file') as i_files,
      (select count(*)::int from issue_items t where t.job = a.job and t.element_id = a.element_id and t.scope = 'issue' and t.kind in ('photo','video') and coalesce(t.body,'') <> 'chat') as i_photos,
      (select t.author || ': ' || left(t.body, 140) from issue_items t where t.job = a.job and t.element_id = a.element_id and t.scope = 'issue' and t.kind = 'comment' order by t.id desc limit 1) as i_last,
      greatest(
        a.updated_at,
        i.updated_at,
        (select max(t.created_at) from issue_items t where t.job = a.job and t.element_id = a.element_id)
      ) as fresh_at
      from action_plans a join issues i on i.job = a.job and i.element_id = a.element_id where a.job = ${job} order by a.no desc`;
    return Response.json({ me: nm(u), can: canEdit(u), aps: aps.filter((a) => canSeeAp(a, u)).map((a) => ({ ...a, jobNo: a.job_no || jobNo(a.no), card: cardNo(a.issue_no) })) });
  }
  if (p.get('list')) {
    // every issue of the job with its card number, status and the counts shown on the card
    const rows = await sql`select i.no, i.element_id, i.description, i.author, i.created_at, i.status, i.priority,
      (select count(*)::int from issue_items t where t.job = i.job and t.element_id = i.element_id and t.scope = 'issue' and (t.kind in ('comment','chat') or (t.kind = 'photo' and t.body = 'chat'))) as comments,
      (select count(*)::int from issue_items t where t.job = i.job and t.element_id = i.element_id and t.scope = 'issue' and t.kind = 'file') as files,
      (select count(*)::int from issue_items t where t.job = i.job and t.element_id = i.element_id and t.scope = 'issue' and t.kind in ('photo','video') and coalesce(t.body,'') <> 'chat') as photos
      from issues i where i.job = ${job} order by i.no desc`;
    // Discipline and Asset: read from the part's schedule row (the columns named Discipline / Asset that this person may see)
    const aps = await sql`select a.element_id, a.no, a.body, a.status, a.assignees, a.author, a.created_at, a.updated_at, a.updated_by, a.job_no,
      (select count(*)::int from issue_items t where t.job = a.job and t.element_id = a.element_id and t.scope = 'ap' and t.kind = 'file') as files,
      (select count(*)::int from issue_items t where t.job = a.job and t.element_id = a.element_id and t.scope = 'ap' and t.kind in ('photo','video')) as photos
      from action_plans a where a.job = ${job}`;
    const apBy = {}; aps.forEach((a) => { if (canSeeAp(a, u)) apBy[a.element_id] = { ...a, jobNo: a.job_no || jobNo(a.no) }; });
    const els = rows.map((r) => r.element_id);
    const rr = els.length ? await sql`select r.element_id, r.vals from rows r join schedules s on s.id = r.schedule_id where s.job = ${job} and r.element_id = any(${els}::text[])` : [];
    const only = allowedCols(u, await getColPerms());
    const info = {};
    rr.forEach((x) => {
      const v = x.vals || {}; const o = info[x.element_id] || (info[x.element_id] = {});
      Object.keys(v).forEach((k) => {
        if (only && !only.some((c) => nk(c) === nk(k))) return;
        const t = typeof v[k] === 'string' || typeof v[k] === 'number' ? String(v[k]).trim() : '';
        if (!t) return;
        if (/discipline/i.test(k) && !o.discipline) o.discipline = t;
        else if (/asset/i.test(k) && !o.asset) o.asset = t;
      });
    });
    return Response.json({ me: nm(u), can: canEdit(u), issues: rows.map((r) => ({ ...r, card: cardNo(r.no), ap: apBy[r.element_id] || null, discipline: (info[r.element_id] || {}).discipline || '', asset: (info[r.element_id] || {}).asset || '' })) });
  }
  if (!el) return no();
  const [issue] = await sql`select description, author, created_at, no, status, priority from issues where job = ${job} and element_id = ${el}`;
  if (issue) issue.card = cardNo(issue.no);
  const scope = p.get('scope') === 'ap' ? 'ap' : 'issue';
  if (scope === 'ap') {
    const [ap] = await sql`select assignees from action_plans where job = ${job} and element_id = ${el}`;
    if (!ap || !canSeeAp(ap, u)) return no();
  }
  const items = await sql`select id, kind, author, body, pathname, name, content_type, created_at from issue_items where job = ${job} and element_id = ${el} and scope = ${scope} order by id`;
  return Response.json({ me: nm(u), can: canEdit(u), issue: issue || null, items });
}

// action "comment": add a chat message. Otherwise: save the description.
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || ''); let el = String(b.element || '');
  const u = await currentUser();
  if (!u || !job || !canJob(u, job)) return no();
  const sql = await issuesDb();
  if (b.action === 'create') {
    // a new issue that is not tied to a part of the model: it gets its own id (n...) instead of an element number
    const d = String(b.description || '').trim().slice(0, 5000);
    if (!d) return Response.json({ error: 'Write the issue first' }, { status: 400 });
    const pr = PRIORITIES.includes(String(b.priority)) ? String(b.priority) : 'noncritical';
    const id = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    await sql`insert into issues(job, element_id, description, author, priority, no) values(${job}, ${id}, ${d}, ${nm(u)}, ${pr}, (select coalesce(max(no), 0) + 1 from issues where job = ${job}))`;
    return Response.json({ ok: true, element: id });
  }
  if (!el) return no();
  if (b.action === 'status') {
    // the author, an editor or a manager may change the status (Open, In Progress, Work Complete, Closed)
    const st = String(b.status || '');
    if (!STATUSES.includes(st)) return Response.json({ error: 'Bad status' }, { status: 400 });
    const [ex] = await sql`select author from issues where job = ${job} and element_id = ${el}`;
    if (ex && ex.author && ex.author !== nm(u) && !canEdit(u)) return Response.json({ error: 'Only the author, an editor or a manager can change the status' }, { status: 403 });
    const r = await sql`update issues set status = ${st}, updated_at = now() where job = ${job} and element_id = ${el} returning element_id`;
    if (!r.length) return Response.json({ error: 'No such issue' }, { status: 404 });
    return Response.json({ ok: true });
  }
  if (b.action === 'ap-create' || b.action === 'ap-update') {
    // only a manager or an editor issues or changes an action plan
    if (!canEdit(u)) return Response.json({ error: 'Only a manager or an editor can do this' }, { status: 403 });
    const [iss] = await sql`select element_id from issues where job = ${job} and element_id = ${el}`;
    if (!iss) return Response.json({ error: 'No such issue' }, { status: 404 });
    if (b.action === 'ap-create') {
      await sql`insert into action_plans(job, element_id, no, body, author, updated_by) values(${job}, ${el}, (select coalesce(max(no), 0) + 1 from action_plans where job = ${job}), '', ${nm(u)}, ${nm(u)}) on conflict (job, element_id) do nothing`;
      return Response.json({ ok: true });
    }
    const [cur] = await sql`select body, status, assignees, job_no from action_plans where job = ${job} and element_id = ${el}`;
    if (!cur) return Response.json({ error: 'No action plan' }, { status: 404 });
    const body = typeof b.body === 'string' ? b.body.slice(0, 5000) : cur.body;
    const status = STATUSES.includes(String(b.status)) ? String(b.status) : cur.status;
    const jno = typeof b.job_no === 'string' ? (b.job_no.trim().slice(0, 30) || null) : cur.job_no;
    let as = cur.assignees;
    if (Array.isArray(b.assignees)) as = b.assignees.slice(0, 30).map((a) => ({ n: String((a && a.n) || '').trim().slice(0, 80), u: a && a.u ? 1 : 0 })).filter((a) => a.n);
    await sql`update action_plans set body = ${body}, status = ${status}, job_no = ${jno}, assignees = ${JSON.stringify(as)}::jsonb, updated_at = now(), updated_by = ${nm(u)} where job = ${job} and element_id = ${el}`;
    return Response.json({ ok: true });
  }
  if (b.action === 'priority') {
    const pr = String(b.priority || '');
    if (!PRIORITIES.includes(pr)) return Response.json({ error: 'Bad priority' }, { status: 400 });
    const [ex] = await sql`select author from issues where job = ${job} and element_id = ${el}`;
    if (!ex) return Response.json({ error: 'No such issue' }, { status: 404 });
    if (ex.author && ex.author !== nm(u) && !canEdit(u)) return Response.json({ error: 'Only the author, an editor or a manager can change this' }, { status: 403 });
    await sql`update issues set priority = ${pr}, updated_at = now() where job = ${job} and element_id = ${el}`;
    return Response.json({ ok: true });
  }
  if (b.action === 'attach') {
    // a photo, video or file sent in the chat (uploaded straight to storage); it stays in the chat, not in the Gallery
    const path = String(b.pathname || '');
    if (!path.startsWith('issues/' + job + '/' + el + '/')) return Response.json({ error: 'Bad path' }, { status: 400 });
    await sql`insert into issue_items(job, element_id, kind, author, name, pathname, content_type) values(${job}, ${el}, 'chat', ${nm(u)}, ${String(b.name || 'file').slice(0, 200)}, ${path}, ${String(b.contentType || '')})`;
    return Response.json({ ok: true });
  }
  if (b.action === 'link') {
    // a photo taken in the camera flow (it also lives in the user's album)
    const [m] = await sql`select pathname from media where pathname = ${String(b.pathname || '')}`;
    if (!m) return Response.json({ error: 'Unknown photo' }, { status: 400 });
    const sc = b.scope === 'ap' ? 'ap' : 'issue';
    if (sc === 'ap') {
      if (!canEdit(u)) return no();
      await sql`update action_plans set updated_at = now(), updated_by = ${nm(u)} where job = ${job} and element_id = ${el}`;
    }
    await sql`insert into issue_items(job, element_id, kind, author, name, pathname, content_type, scope) values(${job}, ${el}, ${b.kind === 'video' ? 'video' : 'photo'}, ${nm(u)}, ${String(b.name || 'photo.jpg')}, ${m.pathname}, ${String(b.contentType || (b.kind === 'video' ? 'video/mp4' : 'image/jpeg'))}, ${sc})`;
    return Response.json({ ok: true });
  }
  if (b.action === 'comment') {
    const body = String(b.body || '').trim().slice(0, 2000);
    if (!body) return Response.json({ error: 'Empty comment' }, { status: 400 });
    await sql`insert into issue_items(job, element_id, kind, author, body) values(${job}, ${el}, 'comment', ${nm(u)}, ${body})`;
    return Response.json({ ok: true });
  }
  const d = String(b.description ?? '').slice(0, 5000);
  const [ex] = await sql`select author from issues where job = ${job} and element_id = ${el}`;
  if (ex && ex.author && ex.author !== nm(u) && !canEdit(u)) return Response.json({ error: 'Only the author, an editor or a manager can change the issue text' }, { status: 403 });
  await sql`insert into issues(job, element_id, description, author, no) values(${job}, ${el}, ${d}, ${nm(u)}, (select coalesce(max(no), 0) + 1 from issues where job = ${job}))
    on conflict (job, element_id) do update set description = excluded.description, updated_at = now()`;
  return Response.json({ ok: true });
}

// Delete one comment, photo or file: its author or an admin.
export async function DELETE(req) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  const u = await currentUser();
  if (!u || !id) return no();
  const sql = await issuesDb();
  const [it] = await sql`select id, job, author, pathname from issue_items where id = ${id}`;
  if (!it || !canJob(u, it.job) || (it.author !== nm(u) && !isAdmin(u))) return no();
  if (it.pathname && it.pathname.startsWith('issues/')) { try { await del(it.pathname); } catch (e) {} }
  await sql`delete from issue_items where id = ${id}`;
  return Response.json({ ok: true });
}
