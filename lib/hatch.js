// How the parts that match NO colour filter are drawn. Kept in one place on purpose, so it can be tuned (or replaced by real stripes) without touching the viewer or the colour rules.
//   settings = { mode: 'tint' | 'grey', grey: 'rrggbb', strength: 0..100, stripe: { angle, spacing, width } }
//   'grey'  every such part is the same flat grey
//   'tint'  grey mixed with the part's own Revit material colour: strength 0 = plain grey, 100 = the material colour itself
//   'stripe' real diagonal hatch: grey background with lines in the part's own Revit colour. stripe = { angle (degrees, lines from horizontal), spacing (screen px between lines), width (line thickness, px) }
//            drawn by a small shader in the 3D viewer (Viewer3D.js applyStripes). Places that cannot draw it (Timeline, previews) use the 'tint' colour instead.
export const hatchKey = 'hatch:settings';
export const HATCH_DEFAULTS = { mode: 'tint', grey: '9a9a9a', strength: 35, stripe: { angle: 45, spacing: 12, width: 2 } };
const clamp = (n, a, b) => Math.min(b, Math.max(a, Number.isFinite(+n) ? +n : a));
const hex6 = (s, d) => (/^[0-9a-f]{6}$/i.test(String(s || '').replace('#', '')) ? String(s).replace('#', '').toLowerCase() : d);
export function cleanHatch(v) {
  const o = v && typeof v === 'object' ? v : {};
  const st = o.stripe && typeof o.stripe === 'object' ? o.stripe : {};
  return {
    mode: o.mode === 'grey' || o.mode === 'stripe' ? o.mode : 'tint',
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

// Line colour for the hatch of one part: its own Revit colour, or a darker grey when it has none.
export function stripeLine(mat, s) {
  const c = cleanHatch(s);
  if (mat) return toHex(rgb(mat).map((x) => Math.round(x / 16) * 16).map((x) => Math.min(255, x)));
  return toHex(rgb(c.grey).map((x) => x * 0.55));
}
// CSS for a preview swatch that looks like the hatch in the viewer
export function stripeCss(mat, s) {
  const c = cleanHatch(s);
  const w = Math.min(c.stripe.width, c.stripe.spacing - 1);
  return `repeating-linear-gradient(${-c.stripe.angle}deg, #${stripeLine(mat, c)} 0px, #${stripeLine(mat, c)} ${w}px, #${c.grey} ${w}px, #${c.grey} ${c.stripe.spacing}px)`;
}
