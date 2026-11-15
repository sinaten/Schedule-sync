// How the parts that match NO colour filter are drawn. Kept in one place on purpose, so it can be tuned (or replaced by real stripes) without touching the viewer or the colour rules.
//   settings = { mode: 'tint' | 'grey', grey: 'rrggbb', strength: 0..100, stripe: { angle, spacing, width } }
//   'grey'  every such part is the same flat grey
//   'tint'  grey mixed with the part's own Revit material colour: strength 0 = plain grey, 100 = the material colour itself
//   'stripe' real hatch: the part is plain grey and lines in its own Revit colour are drawn on its surface (they stick to the part and turn with the model).
//            stripe = { angle (degrees), spacing (inches, model size), width (line thickness, % of spacing), v: 2 }
//            drawn as a thin layer on top of the part (Viewer3D.js applyStripes); if that layer fails the part simply stays grey. The Timeline uses the 'tint' colour.
export const hatchKey = 'hatch:settings';
export const HATCH_DEFAULTS = { mode: 'tint', grey: '9a9a9a', strength: 35, stripe: { angle: 45, spacing: 6, width: 25, v: 2 } };
const clamp = (n, a, b) => Math.min(b, Math.max(a, Number.isFinite(+n) ? +n : a));
const hex6 = (s, d) => (/^[0-9a-f]{6}$/i.test(String(s || '').replace('#', '')) ? String(s).replace('#', '').toLowerCase() : d);
export function cleanHatch(v) {
  const o = v && typeof v === 'object' ? v : {};
  let st = o.stripe && typeof o.stripe === 'object' ? o.stripe : {};
  if (st.v !== 2) st = HATCH_DEFAULTS.stripe; // old screen-pixel values do not mean the same thing
  return {
    mode: o.mode === 'grey' || o.mode === 'stripe' ? o.mode : 'tint',
    grey: hex6(o.grey, HATCH_DEFAULTS.grey),
    strength: clamp(o.strength ?? HATCH_DEFAULTS.strength, 0, 100),
    stripe: { angle: clamp(st.angle ?? 45, 0, 180), spacing: clamp(st.spacing ?? 6, 0.5, 48), width: clamp(st.width ?? 25, 5, 80), v: 2 },
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
// CSS for a preview swatch that looks like the hatch in the viewer (1 inch ≈ 3 px here)
export function stripeCss(mat, s) {
  const c = cleanHatch(s);
  const sp = Math.max(3, c.stripe.spacing * 3), w = Math.max(1, (sp * c.stripe.width) / 100);
  const l = '#' + stripeLine(mat, c), g = '#' + c.grey;
  return `repeating-linear-gradient(${-c.stripe.angle}deg, ${l} 0px, ${l} ${w}px, ${g} ${w}px, ${g} ${sp}px)`;
}
