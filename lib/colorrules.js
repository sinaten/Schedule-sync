// Colour rules of one job, kept on the website. They start as a copy of Revit's view filters (name, colour, order, conditions) and are then
// managed here; the website works the colours out by itself from the part values, so it needs no help from Revit afterwards.
//   rules = { filters: [ { id, name, color:'rrggbb', enabled, tree:{ logic:'and'|'or', items:[ leaf | tree ] } } ] }   (first matching filter wins)
//   leaf  = { param, op, value, kind?, not? }
export const rulesKey = (job) => 'colorrules:' + (job || '');
export async function getColorRules(sql, job) {
  const [r] = await sql`select value from settings where key = ${rulesKey(job)}`;
  return (r && r.value && Array.isArray(r.value.filters)) ? r.value : null;
}
export async function putColorRules(sql, job, v) {
  await sql`insert into settings(key, value) values(${rulesKey(job)}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set value = excluded.value`;
}
// Revit wraps every condition in a group of its own; groups with the same logic as their parent are opened so the list is flat and easy to edit.
export function flatten(t) {
  if (!t || !Array.isArray(t.items)) return { logic: 'and', items: [] };
  const logic = t.logic === 'or' ? 'or' : 'and';
  const items = [];
  for (const it of t.items) {
    if (it && Array.isArray(it.items)) {
      const c = flatten(it);
      if (c.items.length === 1 || c.logic === logic) items.push(...c.items); else items.push(c);
    } else if (it) items.push(it);
  }
  return { logic, items };
}
export function fromLook(look) {
  const fs = Array.isArray(look && look.filters) ? look.filters : [];
  return {
    from: 'revit', at: Date.now(),
    filters: fs.map((f, i) => ({ id: 'f' + i, name: String(f.name || 'Filter ' + (i + 1)), color: String(f.color || '808080').toLowerCase(), enabled: true, cats: Array.isArray(f.cats) ? f.cats : [], tree: flatten(f.rules) })),
  };
}
const nk = (s) => String(s ?? '').toLowerCase().replace(/[\s\-_]/g, '');
const opName = (op) => String(op || 'equals').replace(/^Filter(Numeric|String)?/i, '').toLowerCase() || 'equals';
function leaf(l, vals, keys) {
  let v = vals[l.param];
  if (v === undefined && keys) v = vals[keys[nk(l.param)]];
  if (typeof v === 'boolean') v = v ? 1 : 0;
  let b = l.value;
  if (typeof b === 'boolean') b = b ? 1 : 0;
  const op = opName(l.op);
  let r;
  const num = (x) => (x === null || x === undefined || x === '' ? NaN : Number(x));
  if (op === 'greater') r = num(v) > num(b);
  else if (op === 'greaterorequal') r = num(v) >= num(b);
  else if (op === 'less') r = num(v) < num(b);
  else if (op === 'lessorequal') r = num(v) <= num(b);
  else if (op === 'contains') r = String(v ?? '').toLowerCase().includes(String(b ?? '').toLowerCase());
  else if (op === 'beginswith') r = String(v ?? '').toLowerCase().startsWith(String(b ?? '').toLowerCase());
  else if (op === 'endswith') r = String(v ?? '').toLowerCase().endsWith(String(b ?? '').toLowerCase());
  else r = (typeof b === 'number' && !Number.isNaN(num(v))) ? num(v) === b : String(v ?? '').toLowerCase() === String(b ?? '').toLowerCase();
  return l.not ? !r : r;
}
export function matches(tree, vals, keys) {
  if (!tree || !Array.isArray(tree.items) || !tree.items.length) return false; // a filter without conditions matches nothing
  const each = tree.items.map((it) => (it && Array.isArray(it.items) ? matches(it, vals, keys) : leaf(it, vals, keys)));
  return tree.logic === 'or' ? each.some(Boolean) : each.every(Boolean);
}
// rows: [{ element_id, vals }] (one entry per element, values of all its schedules merged). Result: { 'rrggbb': [elementId, ...] }
export function computeColors(rules, rows) {
  const fs = (rules.filters || []).filter((f) => f.enabled !== false && /^[0-9a-f]{6}$/i.test(String(f.color)));
  const out = {};
  for (const r of rows) {
    const vals = r.vals || {};
    const keys = {};
    for (const k in vals) keys[nk(k)] = k;
    for (const f of fs) {
      if (matches(f.tree, vals, keys)) { const h = String(f.color).toLowerCase(); (out[h] = out[h] || []).push(Number(r.element_id)); break; }
    }
  }
  return out;
}
