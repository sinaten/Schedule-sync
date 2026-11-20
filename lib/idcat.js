// The catalog of things that get an ID (items, buttons, bars) and the page codes. Admin edits it in Admin > Data mapping > Tracking IDs.
// Nothing here changes any card or button: it only describes how their IDs WOULD be built, and collects unknown buttons for the admin to approve.
import { idValues, cleanIdFormat, makeId } from './ids';
export const catKey = 'id:catalog';
export const pendKey = 'id:pending';

export const TOKENS = [
  { k: 'base', n: 'First string', h: 'the whole string set above (place, project, creator, access, date, version)' },
  { k: 'loc', n: 'Place', h: 'country, state, city' },
  { k: 'project', n: 'Project', h: 'project name' },
  { k: 'page', n: 'Page', h: 'where it is' },
  { k: 'item', n: 'Item', h: 'type code + its number' },
  { k: 'type', n: 'Kind', h: 'BTN, BAR or TAB' },
  { k: 'action', n: 'Action', h: 'what it does' },
  { k: 'element', n: 'Element', h: 'Revit element number' },
  { k: 'parent', n: 'Action plan', h: 'the action plan the message is in (ACT01), when it is in one' },
  { k: 'com', n: 'Communication', h: 'COM' },
  { k: 'user', n: 'Writer', h: 'who sent it' },
  { k: 'stamp', n: 'Date and time', h: 'year-month-day-hhmm' },
  { k: 'seq', n: 'Message number', h: 'order inside the conversation' },
];
const P = (...k) => k.map((x) => ({ k: x, on: true }));
const item = (key, name, code, desc, parts) => ({ key, group: 'item', name, desc, code, word: '', action: '', labels: [], parts: parts || P('base', 'item') });
const msgT = (key, name, desc, kind, parts) => ({ key, group: 'message', name, desc, code: '', word: kind, action: '', labels: [], parts: parts || P('base', 'item', 'com', 'type', 'user', 'stamp', 'seq') });
const btn = (key, name, desc, action, labels, parts) => ({ key, group: 'button', name, desc, code: '', word: 'BTN', action, labels, parts: parts || P('loc', 'project', 'item', 'type', 'action') });
const bar = (key, name, desc, word, action, labels, parts) => ({ key, group: 'bar', name, desc, code: '', word, action, labels, parts: parts || P('loc', 'project', 'page', 'type', 'action') });
export const SEED = {
  types: [
    item('issue', 'Issue card', 'ISS', 'A problem card (no element number in its ID)', P('base', 'item')),
    item('elink', 'Element link', 'ISS', 'An element number written in a card description: it links to the model; ID = the card + that element', P('base', 'item', 'element')),
    item('ap', 'Action plan card', 'AP', 'An action plan made from an issue'),
    item('followup', 'Follow-up item', 'FU', 'A row in HSE, Orders, Utility, Communication, Workflow, Location'),
    item('msg', 'Message / comment', 'MSG', 'Text written with Send inside a card'),
    item('media', 'Photo / video', 'MED', 'One gallery file'),
    item('snap', 'Snapshot', 'SNP', 'A picture of the 3D view'),
    item('cam', 'Camera view', 'CAM', 'A saved 3D camera view'),
    item('sbox', 'Section box', 'SBX', 'A saved section box'),
    item('sect', 'Section (QR)', 'SCT', 'A section that has a QR code'),
    item('visit', 'Visit', 'VIS', 'A QR scan with time and GPS'),
    item('hist', 'History record', 'HST', 'One saved History record'),
    item('edit', 'Tick / edit', 'EDT', 'One change of a tick or value', P('base', 'item', 'element')),
    item('sched', 'Schedule', 'SCH', 'A Revit schedule synced to the site'),
    item('row', 'Schedule row', 'ROW', 'One row (one element) of a schedule', P('base', 'item', 'element')),
    msgT('m-txt', 'Message: text', 'A typed message in the Communication of a card', 'TXT'),
    msgT('m-voi', 'Message: voice', 'A voice note in the Communication of a card', 'VOI'),
    msgT('m-img', 'Message: photo', 'A photo sent in the Communication of a card', 'IMG'),
    msgT('m-vid', 'Message: video', 'A video sent in the Communication of a card', 'VID'),
    msgT('m-fil', 'Message: file', 'A file sent in the Communication of a card', 'FIL'),
    msgT('m-apv', 'Message in an action plan', 'The same, but written inside an action plan of the card (voice shown; text, photo, video, file work the same)', 'VOI', P('base', 'item', 'parent', 'com', 'type', 'user', 'stamp', 'seq')),
    btn('b-status', 'Status buttons', 'Open, In progress, Ready, Done, Closed on a card', 'STATUS-OPEN', ['open', 'in progress', 'prog', 'ready', 'done', 'closed'], P('loc', 'project', 'item', 'type', 'action', 'element')),
    btn('b-prio', 'Priority buttons', 'Critical / Non-critical on a card', 'PRIORITY-CRITICAL', ['critical', 'non-critical', 'noncritical']),
    btn('b-card', 'Card buttons', 'Add, Send, Delete, Close, Camera, Go to 3D, Copy, Clear issue', 'SEND', ['add', 'send', 'delete', 'close', 'camera', 'go to 3d', 'copy', 'new issue', 'confirm clearing the issue']),
    btn('b-3d', '3D model buttons', 'Section box, Save, Reset, image quality', '3D-SECTIONBOX', ['section box', 'image quality', 'reset', 'section boxes']),
    btn('b-media', 'Gallery buttons', 'Share link and similar', 'SHARE', ['share link'], P('loc', 'project', 'item', 'type', 'action')),
    btn('b-phone', 'Phone bottom bar', 'Refresh, R, QR scan, Gallery, Save: the same bar on every page', 'PHONE-QR', ['scan qr code', 'photos and videos', 'refresh this page from the website', 'refresh the model from revit', 'save changes'], P('page', 'type', 'action')),
    bar('t-tab', 'Project tabs', 'Inspection and Follow-up', 'TAB', 'FOLLOWUP', ['inspection', 'follow-up']),
    bar('t-bar', 'Follow-up bars', 'Weather, Action Plan, Workflow, Location, HSE, Communication, Orders, Utility', 'BAR', 'HSE', ['weather', 'action plan', 'workflow', 'location', 'hse', 'communication', 'orders', 'utility']),
    bar('t-admin', 'Admin tabs', 'Users, Projects, Workflow, Data mapping ...', 'TAB', 'DATAMAP', ['users', 'projects', 'data mapping', 'photos & videos', 'analysis', 'user manage', 'settings', 'ai'], P('page', 'type', 'action')),
  ],
  pages: [
    { k: 'HOME', code: 'PG-HOME', name: 'Jobs list' },
    { k: 'ISSUES', code: 'PG-ISSUES', name: 'Project, Inspection tab' },
    { k: 'FOLLOWUP', code: 'PG-FOLLOWUP', name: 'Project, Follow-up tab' },
    { k: 'GALLERY', code: 'PG-GALLERY', name: 'Photos and videos' },
    { k: 'SCAN', code: 'PG-SCAN', name: 'QR scan' },
    { k: 'ADMIN', code: 'PG-ADMIN', name: 'Admin' },
  ],
};
const word = (v, n) => String(v ?? '').replace(/[^A-Za-z0-9-]/g, '').toUpperCase().slice(0, n);
export function cleanCatalog(v) {
  const o = v && typeof v === 'object' ? v : {};
  const have = new Map((Array.isArray(o.types) ? o.types : []).filter((t) => t && t.key).map((t) => [String(t.key), t]));
  const types = [];
  const mk = (b, t) => {
    const parts = []; const seen = new Set();
    for (const x of Array.isArray(t && t.parts) && !(b.group === 'item' && !(o.v >= 3)) ? t.parts : []) if (x && TOKENS.some((k) => k.k === x.k) && !seen.has(x.k)) { seen.add(x.k); parts.push({ k: x.k, on: x.on !== false }); }
    for (const x of b.parts) if (!seen.has(x.k)) parts.push({ k: x.k, on: x.on });
    return { key: b.key, group: b.group, name: String((t && t.name) || b.name).slice(0, 60), desc: b.desc, code: t && t.code != null ? word(t.code, 8) : b.code, word: t && t.word != null ? word(t.word, 8) : b.word, action: t && t.action != null ? word(t.action, 40) : b.action, labels: Array.isArray(t && t.labels) ? t.labels.map((x) => String(x).toLowerCase().slice(0, 60)).slice(0, 60) : b.labels, parts, added: !!(t && t.added) };
  };
  for (const b of SEED.types) { types.push(mk(b, have.get(b.key))); have.delete(b.key); }
  for (const [k, t] of have) if (t.added) types.push(mk({ key: word(k, 30) || 'x', group: 'button', name: t.name || k, desc: t.desc || 'Added from a new button', code: '', word: 'BTN', action: '', labels: [], parts: P('page', 'type', 'action') }, t));
  const pg = new Map((Array.isArray(o.pages) ? o.pages : []).map((x) => [x && x.k, x]));
  const pages = SEED.pages.map((b) => ({ k: b.k, name: b.name, code: pg.get(b.k) && pg.get(b.k).code ? word(pg.get(b.k).code, 16) : b.code }));
  return { v: 3, types, pages };
}
export async function getCatalog(sql) { const [r] = await sql`select value from settings where key = ${catKey}`; return cleanCatalog(r && r.value); }

function stampOf(d) {
  const x = d instanceof Date ? d : new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(x).map((q) => [q.type, q.value]));
  return p.year + '-' + p.month + '-' + p.day + '-' + p.hour + p.minute;
}
// A sample ID of one type, built from the base format (place, separator) and this type's own parts.
export function typeId(base, cat, t, ctx) {
  const f = cleanIdFormat(base); const v = idValues(f, ctx);
  const page = (cat.pages.find((p) => p.k === (ctx.pageKey || 'ISSUES')) || cat.pages[0] || {}).code || 'PG';
  const out = [];
  for (const x of t.parts) {
    if (!x.on) continue;
    if (x.k === 'base') out.push(makeId(f, ctx));
    else if (x.k === 'loc') out.push(v.country, v.state, v.city);
    else if (x.k === 'project') out.push(v.project);
    else if (x.k === 'page') out.push(page);
    else if (x.k === 'item') out.push((t.group === 'item' ? t.code : 'ISS') + String(ctx.serial || 8).padStart(4, '0'));
    else if (x.k === 'type') { if (t.word) out.push(t.word); }
    else if (x.k === 'action') { if (t.action) out.push(t.action); }
    else if (x.k === 'element') out.push(String(ctx.element || 1702105));
    else if (x.k === 'parent') out.push('ACT01');
    else if (x.k === 'com') out.push('COM');
    else if (x.k === 'user') out.push(String(ctx.writer || v.creator || 'user'));
    else if (x.k === 'stamp') out.push(stampOf(ctx.when));
    else if (x.k === 'seq') out.push(String(ctx.seq || 1).padStart(2, '0'));
  }
  return out.filter(Boolean).join(f.sep);
}

// Which page a path is. tab = 'inspection' | 'follow-up' (project page) or the admin tab.
export function pageKey(path, tab) {
  const p = String(path || '/'); const t = String(tab || '').toLowerCase();
  if (p === '/' || p === '') return 'HOME';
  if (p.startsWith('/j/')) return t.includes('follow') ? 'FOLLOWUP' : 'ISSUES';
  if (p.startsWith('/media')) return 'GALLERY';
  if (p.startsWith('/scan')) return 'SCAN';
  if (p.startsWith('/admin')) return 'ADMIN';
  return p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 20) || 'OTHER';
}
// null = a button the catalog does not know yet.
export function classify(cat, label) {
  const l = String(label || '').trim().toLowerCase();
  if (!l) return 'skip';
  for (const t of cat.types) if (t.labels.includes(l)) return t.key;
  return null;
}
export const slug = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
