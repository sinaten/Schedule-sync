// A scenario: a picture (the aerial view of a site or an uploaded picture) with pins, arrows, routes and labels, and a description.
// It has its own secret link (/scenario/<token>), always on, that anyone can open without logging in.
const num = (v, a, b) => { const n = Number(v); return Number.isFinite(n) && n >= a && n <= b ? n : null; };
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
export function cleanScenario(b) {
  b = b || {};
  const image = b.image && typeof b.image.path === 'string' && b.image.path.startsWith('sitefiles/') && !b.image.path.includes('..')
    ? { path: b.image.path.slice(0, 300), w: num(b.image.w, 1, 20000) || 1000, h: num(b.image.h, 1, 20000) || 1000 } : null;
  const base = b.base === 'image' && image ? 'image' : 'aerial';
  const big = base === 'image' ? 20000 : 180;
  const pts = (a) => (Array.isArray(a) ? a : []).slice(0, 80).map((p) => [num(p && p[0], -big, big), num(p && p[1], -big, big)]).filter((p) => p[0] !== null && p[1] !== null);
  const pins = (Array.isArray(b.pins) ? b.pins : []).slice(0, 80).map((p) => ({ type: str(p && p.type, 60), where: str(p && p.where, 160), lat: num(p && p.lat, -big, big), lng: num(p && p.lng, -big, big) })).filter((p) => p.lat !== null && p.lng !== null && (p.type || p.where));
  const marks = (Array.isArray(b.marks) ? b.marks : []).slice(0, 120).map((m) => ({ id: str(m && m.id, 20), k: ['arrow', 'route', 'text'].includes(m && m.k) ? m.k : 'arrow', pts: pts(m && m.pts), text: str(m && m.text, 200) }))
    .filter((m) => (m.k === 'text' ? m.pts.length >= 1 && m.text : m.pts.length >= 2));
  const v = b.view || {};
  const bd = Array.isArray(v.bounds) && v.bounds.length === 2 ? v.bounds.map((p) => [num(p && p[0], -90, 90), num(p && p[1], -180, 180)]) : null; // the frame of the aerial view when it was saved
  const view = num(v.lat, -big, big) !== null && num(v.lng, -big, big) !== null ? { lat: v.lat, lng: v.lng, zoom: num(v.zoom, -10, 22), bounds: base === 'aerial' && bd && bd.every((p) => p[0] !== null && p[1] !== null) ? bd : null } : null;
  const st = b.start || {};
  const start = num(st.lat, -90, 90) !== null && num(st.lng, -180, 180) !== null ? { lat: st.lat, lng: st.lng, name: str(st.name, 120) } : null; // real GPS point where the way begins (Google Maps takes people there)
  return { name: str(b.name, 80).trim() || 'Scenario', base, image, pins, marks, view, start, desc: str(b.desc, 6000) };
}
