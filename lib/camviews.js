// Saved camera views of a job (made by an admin on the website): { id, name, icon, cam, view, by, at }.
// An Issue text can hold one as a token, [[view:ID]], which is drawn as the view's icon in the middle of the words.
export const camKey = (job) => 'camviews:' + (job || '');
export const CAM_ICONS = { camera: '\u{1F4F7}', eye: '\u{1F441}️', warning: '⚠️', person: '\u{1F6B6}', pin: '\u{1F4CD}' };
export const TOKEN = /\[\[view:([a-z0-9]+)\]\]/gi;
// In the editor a camera is written C + its number (C12) instead of the stored token [[view:ID]].
export function camToEdit(t, views) {
  return String(t || '').replace(new RegExp(TOKEN.source, 'gi'), (m, id, off, str) => { const v = (views || []).find((x) => x.id === id); if (!(v && v.n)) return m; return (/\w/.test(str[off - 1] || '') ? ' ' : '') + 'C' + v.n + (/\w/.test(str[off + m.length] || '') ? ' ' : ''); });
}
export function camFromEdit(t, views) {
  return String(t || '').replace(/(?<![\w.])C(\d+)(?![\w.])/g, (m, n) => { const v = (views || []).find((x) => String(x.n) === n); return v ? '[[view:' + v.id + ']]' : m; });
}
export async function getCamViews(sql, job) {
  const [r] = await sql`select value from settings where key = ${camKey(job)}`;
  return Array.isArray(r && r.value) ? r.value : [];
}
export async function putCamViews(sql, job, list) {
  await sql`insert into settings(key, value) values(${camKey(job)}, ${JSON.stringify(list)}::jsonb) on conflict (key) do update set value = excluded.value`;
}

// The saved camera view that a QR (= section id) is connected to: { job, view } or null.
export async function findViewByQr(sql, qr) {
  const rows = await sql`select key, value from settings where key like 'camviews:%'`;
  for (const r of rows) {
    const v = (Array.isArray(r.value) ? r.value : []).find((x) => x.qr === qr);
    if (v) return { job: r.key.slice('camviews:'.length), view: v };
  }
  return null;
}
