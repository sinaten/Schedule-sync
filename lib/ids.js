// The ID engine. It only BUILDS an ID from the settings (Admin > Settings > ID format); nothing on the site uses it yet.
// ID = parts joined by the separator, in the order set by the admin, e.g. US-OH-COL-CLT86-sina-0-26-11-2134-V1
export const idKey = 'id:format';
export const PARTS = [
  { k: 'country', n: 'Country', h: 'from the project\'s site' },
  { k: 'state', n: 'State', h: 'read from the site address (", OH 43215")' },
  { k: 'city', n: 'City', h: 'from the project\'s site' },
  { k: 'project', n: 'Project', h: 'the project name' },
  { k: 'creator', n: 'Creator', h: 'username' },
  { k: 'access', n: 'Access', h: '0 all, 1 owner, 2 editor, 3 manager' },
  { k: 'year', n: 'Year', h: 'two digits, automatic' },
  { k: 'month', n: 'Month', h: 'automatic' },
  { k: 'time', n: 'Time', h: 'hour and minute, automatic' },
  { k: 'version', n: 'Version', h: 'V1, then V2 ... on every edit' },
];
export const ID_DEFAULTS = { sep: '-', show: false, tz: 'America/New_York', segs: PARTS.map((p) => ({ k: p.k, on: true })), codes: '' };

export function cleanIdFormat(v) {
  const o = v && typeof v === 'object' ? v : {};
  const seen = new Set(); const segs = [];
  for (const x of Array.isArray(o.segs) ? o.segs : []) { if (x && PARTS.some((p) => p.k === x.k) && !seen.has(x.k)) { seen.add(x.k); segs.push({ k: x.k, on: x.on !== false }); } }
  for (const p of PARTS) if (!seen.has(p.k)) segs.push({ k: p.k, on: true });
  const sep = String(o.sep ?? ID_DEFAULTS.sep).slice(0, 3);
  let tz = String(o.tz || ID_DEFAULTS.tz); try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch (e) { tz = ID_DEFAULTS.tz; }
  return { sep, show: !!o.show, tz, segs, codes: String(o.codes || '').slice(0, 4000) };
}
export async function getIdFormat(sql) {
  const [r] = await sql`select value from settings where key = ${idKey}`;
  return cleanIdFormat(r && r.value);
}

// "Columbus=COL" lines the admin writes to choose a short code for a name.
function codeMap(text) {
  const m = {};
  for (const ln of String(text || '').split('\n')) { const i = ln.indexOf('='); if (i > 0) { const a = ln.slice(0, i).trim().toLowerCase(), b = ln.slice(i + 1).trim(); if (a && b) m[a] = b; } }
  return m;
}
const clean = (t) => String(t || '').replace(/[^A-Za-z0-9]/g, '');
const COUNTRY = { 'united states': 'US', usa: 'US', 'united states of america': 'US', canada: 'CA', iran: 'IR', 'united kingdom': 'GB', uk: 'GB' };
function short(name, n, codes, table) {
  const k = String(name || '').trim().toLowerCase();
  if (!k) return 'XX';
  if (codes[k]) return clean(codes[k]);
  if (table && table[k]) return table[k];
  return clean(name).slice(0, n).toUpperCase() || 'XX';
}
const stateOf = (addr) => { const m = String(addr || '').match(/,\s*([A-Za-z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?\s*(?:,|$)/); return m ? m[1].toUpperCase() : ''; };

// ctx: { country, address, city, project, creator, access (0-3), version (1+), date (Date) }
export function idValues(fmt, ctx) {
  const f = cleanIdFormat(fmt); const codes = codeMap(f.codes); const d = ctx.date instanceof Date ? ctx.date : new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: f.tz, year: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return {
    country: ctx.countryCode ? clean(ctx.countryCode).toUpperCase().slice(0, 3) : short(ctx.country, 2, codes, COUNTRY),
    state: ctx.stateCode ? clean(ctx.stateCode).toUpperCase().slice(0, 3) : stateOf(ctx.address) || 'XX',
    city: short(ctx.city, 3, codes),
    project: clean(ctx.project).toUpperCase() || 'NA',
    creator: clean(ctx.creator).toLowerCase() || 'system',
    access: String(Math.min(3, Math.max(0, Math.round(Number(ctx.access) || 0)))),
    year: p.year, month: p.month, time: p.hour + p.minute,
    version: 'V' + Math.max(1, Math.round(Number(ctx.version) || 1)),
  };
}
export function makeId(fmt, ctx) {
  const f = cleanIdFormat(fmt); const val = idValues(f, ctx);
  return f.segs.filter((s) => s.on).map((s) => val[s.k]).join(f.sep);
}

// Country, state and city of a map pin (OpenStreetMap Nominatim). Asked once per place, then kept in the settings table.
async function geo(sql, lat, lng) {
  const key = 'geo:' + lat.toFixed(3) + ',' + lng.toFixed(3);
  const [c] = await sql`select value from settings where key = ${key}`;
  if (c && c.value) return c.value;
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=en&lat=' + lat + '&lon=' + lng, { headers: { 'user-agent': 'schedule-sync/1.0 (project ids)' }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const a = ((await r.json()) || {}).address || {};
    const iso = String(a['ISO3166-2-lvl4'] || '');
    const g = { countryCode: String(a.country_code || '').toUpperCase(), stateCode: iso.includes('-') ? iso.split('-')[1] : '', country: a.country || '', city: a.city || a.town || a.village || a.municipality || a.county || '' };
    if (!g.countryCode) return null;
    await sql`insert into settings(key, value) values(${key}, ${JSON.stringify(g)}::jsonb) on conflict (key) do update set value = excluded.value`;
    return g;
  } catch (e) { return null; }
}

// The place and name of one project, read from Admin > Projects. The map pin (GPS) wins; typed country / city / address are the fallback.
export async function projectContext(sql, job) {
  const [pm] = await sql`select value from settings where key = ${'projmeta:' + job}`;
  const p = (pm && pm.value) || {};
  let s = {};
  if (p.siteId) { const [r] = await sql`select value from settings where key = ${'site:' + p.siteId}`; if (r && r.value) s = r.value; }
  const ctx = { country: s.country || p.country || '', city: s.city || p.city || '', address: s.address || p.address || '', project: job, from: 'text' };
  const la = Number(s.lat ?? p.lat), lo = Number(s.lng ?? p.lng);
  if ((s.lat ?? p.lat) != null && Number.isFinite(la) && Number.isFinite(lo)) {
    const g = await geo(sql, la, lo);
    if (g) { ctx.countryCode = g.countryCode; ctx.stateCode = g.stateCode; ctx.country = g.country || ctx.country; ctx.city = g.city || ctx.city; ctx.from = 'gps'; }
  }
  if (ctx.from === 'text' && !ctx.country && !ctx.city && !ctx.address) ctx.from = 'none';
  return ctx;
}
