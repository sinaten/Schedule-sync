// Saved camera views of a job (made by an admin on the website): { id, name, icon, cam, view, by, at }.
// An Issue text can hold one as a token, [[view:ID]], which is drawn as the view's icon in the middle of the words.
export const camKey = (job) => 'camviews:' + (job || '');
export const CAM_ICONS = { camera: '\u{1F4F7}', eye: '\u{1F441}️', warning: '⚠️', person: '\u{1F6B6}', pin: '\u{1F4CD}' };
export const TOKEN = /\[\[view:([a-z0-9]+)\]\]/gi;
export async function getCamViews(sql, job) {
  const [r] = await sql`select value from settings where key = ${camKey(job)}`;
  return Array.isArray(r && r.value) ? r.value : [];
}
export async function putCamViews(sql, job, list) {
  await sql`insert into settings(key, value) values(${camKey(job)}, ${JSON.stringify(list)}::jsonb) on conflict (key) do update set value = excluded.value`;
}
