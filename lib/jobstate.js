// Status of a job: 'active' (default), 'inactive' (nothing is sent / shown as inactive) or 'deleted' (the project was deleted in Revit).
// by: 'site' = set on the website (Revit only gets a tick-off mark, you can still work in Revit), 'revit' = set in the Revit add-in.
export async function getJobState(sql, job) {
  const [r] = await sql`select value from settings where key = ${'jobstate:' + job}`;
  const v = r && r.value;
  return v && v.state ? { state: v.state, by: v.by || '', title: v.title || '', at: v.at || 0 } : { state: 'active', by: '', title: '', at: 0 };
}
export async function setJobState(sql, job, state, by, title) {
  const old = await getJobState(sql, job);
  const v = { state, by, title: title !== undefined && title !== null && title !== '' ? String(title) : old.title, at: Date.now() };
  await sql`insert into settings(key, value) values(${'jobstate:' + job}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return v;
}
// true when the add-in must not store anything for this job
export async function blocked(sql, job) {
  if (!job) return false;
  return (await getJobState(sql, job)).state !== 'active';
}
