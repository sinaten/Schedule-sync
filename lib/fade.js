// Parts that match NO colour filter: their own Revit material colour, faded toward white by `amount` % (0 = the full Revit colour, 90 = almost white).
// Parts with a filter (parameters / ticks) never come through here: they keep their solid colour.
export const fadeKey = 'fade:settings';
export const FADE_DEFAULTS = { amount: 60 };
const GREY = '9a9a9a'; // a part with no Revit colour
export function cleanFade(v) {
  const n = Number(v && typeof v === 'object' ? v.amount : NaN);
  return { amount: Number.isFinite(n) ? Math.min(90, Math.max(0, Math.round(n))) : FADE_DEFAULTS.amount };
}
// mat = the part's Revit colour 'rrggbb' (or null). Rounded to steps of 8 so parts share colours (fewer calls in the viewer).
export function fadeColor(mat, s) {
  const k = cleanFade(s).amount / 100;
  const n = parseInt(/^[0-9a-f]{6}$/i.test(String(mat || '')) ? mat : GREY, 16);
  return [16, 8, 0].map((sh) => { const x = (n >> sh) & 255; return Math.min(255, Math.round((x + (255 - x) * k) / 8) * 8).toString(16).padStart(2, '0'); }).join('');
}
