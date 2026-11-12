// Each website user's own tick changes live in a separate layer: { edits:[{scheduleId,elementId,col,value}], look:{colors}|null, rev }.
// The real (Revit) data is never touched by a layer; Revit works out the colours of a layer (look) and a manager can later move it into the model.
export const layerKey = (job, user) => 'layer:' + (job || '') + ':' + (user || 'admin');
export async function getLayer(sql, job, user) {
  const [r] = await sql`select value from settings where key = ${layerKey(job, user)}`;
  const v = (r && r.value) || {};
  return { edits: Array.isArray(v.edits) ? v.edits : [], look: v.look || null, rev: v.rev || 0 };
}
export async function putLayer(sql, job, user, v) {
  await sql`insert into settings(key, value) values(${layerKey(job, user)}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set value = excluded.value`;
}
