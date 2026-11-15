// How the parts that match NO colour filter are drawn. Kept in one place on purpose, so it can be tuned (or replaced by real stripes) without touching the viewer or the colour rules.
//   settings = { mode: 'tint' | 'grey', grey: 'rrggbb', strength: 0..100, stripe: { angle, spacing, width } }
//   'grey'  every such part is the same flat grey
//   'tint'  grey mixed with the part's own Revit material colour: strength 0 = plain grey, 100 = the material colour itself
//   stripe  is stored for the real diagonal-line version (not drawn yet); the tint is the phone-safe look until it is tested on a phone.
export const hatchKey = 'hatch:settings';
export const HATCH_DEFAULTS = { mode: 'tint', grey: '9a9a9a', strength: 35, stripe: { angle: 45, spacing: 12, width: 2 } };
const clamp = (n, a, b) => Math.min(b, Math.max(a, Number.isFinite(+n) ? +n : a));
const hex6 = (s, d) => (/^[0-9a-f]{6}$/i.test(String(s || '').replace('#', '')) ? String(s).replace('#', '').toLowerCase() : d);
export function cleanHatch(v) {
  const o = v && typeof v === 'object' ? v : {};
  const st = o.stripe && typeof o.stripe === 'object' ? o.stripe : {};
  return {
    mode: o.mode === 'grey' ? 'grey' : 'tint',
    grey: hex6(o.grey, HATCH_DEFAULTS.grey),
    strength: clamp(o.strength ?? HATCH_DEFAULTS.strength, 0, 100),
    stripe: { angle: clamp(st.angle ?? 45, 0, 180), spacing: clamp(st.spacing ?? 12, 2, 100), width: clamp(st.width ?? 2, 1, 50) },
  };
}
const rgb = (h) => { const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (a) => a.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
// colour of one part with no filter. mat = its Revit material colour ('rrggbb') or null. The result is rounded to steps of 16 so parts share colours (fewer calls in the viewer).
export function hatchColor(mat, s) {
  const c = cleanHatch(s);
  if (c.mode === 'grey' || !mat) return c.grey;
  const g = rgb(c.grey), m = rgb(mat), k = c.strength / 100;
  return toHex(g.map((x, i) => Math.min(255, Math.round((x + (m[i] - x) * k) / 16) * 16)));
}
