// Project settings set by the admin (Admin > Projects). A "project" here is a job number.
// Stored in the settings table: 'projmeta:<job>' for one project, 'sitemeta:<country>>city>site>' for what every project of that site inherits.
export const WORKFLOWS = ['Issue and action plan', 'Periodic inspection', 'Commissioning (PFC / FPT)', 'HSE walk'];

const s = (v, n = 120) => String(v ?? '').trim().slice(0, n);
const num = (v, lo, hi) => { if (v === null || v === undefined || v === '') return null; const x = Number(v); return Number.isFinite(x) && x >= lo && x <= hi ? x : null; };
const list = (a, f) => (Array.isArray(a) ? a.slice(0, 60).map(f).filter(Boolean) : []);
const contact = (x) => { const o = { role: s(x && x.role, 60), name: s(x && x.name, 80), phone: s(x && x.phone, 40) }; return o.role || o.name || o.phone ? o : null; };
const place = (x) => { const o = { type: s(x && x.type, 60), where: s(x && x.where, 160) }; return o.type || o.where ? o : null; };
const wf = (w) => { const o = {}; if (w && typeof w === 'object') for (const k of WORKFLOWS) if (w[k] === 0 || w[k] === 1 || w[k] === true || w[k] === false) o[k] = w[k] ? 1 : 0; return o; };

// What every project of a site inherits.
export function cleanSite(b) {
  return { contacts: list(b && b.contacts, contact), places: list(b && b.places, place), wf: wf(b && b.wf) };
}
// A site: where it is, and what every project inside it shares.
export function cleanSiteFull(b) {
  const lat = num(b && b.lat, -90, 90), lng = num(b && b.lng, -180, 180);
  return {
    name: s(b && b.name, 100), country: s(b && b.country, 60), city: s(b && b.city, 80), address: s(b && b.address, 200),
    lat: lat !== null && lng !== null ? lat : null, lng: lat !== null && lng !== null ? lng : null,
    ...cleanSite(b),
  };
}
// One project. It belongs to a site (siteId); the old country / city / site / address fields are only kept so nothing is lost.

export function cleanProject(b) {
  const lat = num(b && b.lat, -90, 90), lng = num(b && b.lng, -180, 180);
  return {
    siteId: s(b && b.siteId, 80),
    country: s(b && b.country, 60), city: s(b && b.city, 80), site: s(b && b.site, 100),
    address: s(b && b.address, 200), lat: lat !== null && lng !== null ? lat : null, lng: lat !== null && lng !== null ? lng : null,
    ...cleanSite(b),
  };
}
export const siteKey = (p) => (p && p.country && p.city && p.site ? [p.country, p.city, p.site].join('>') : '');
