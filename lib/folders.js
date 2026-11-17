// Every job Revit sends gets a folder (a project record) named exactly like the Revit job. It starts with no site; it is attached later from Projects.
export async function ensureFolder(sql, job) {
  job = String(job || '').trim();
  if (!job) return;
  await sql`insert into settings(key, value) values(${'projmeta:' + job}, ${JSON.stringify({ siteId: '', auto: true, createdAt: Date.now() })}::jsonb) on conflict (key) do nothing`;
}
