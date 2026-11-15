// Change counter of a job. Every change that reaches the model (a Revit publish, edits written into Revit, new schedule data) raises it.
// Pages of people who may open the job notice the new number and bring themselves up to date. It lives in our own database: it costs no Autodesk calls.
// n = the counter; fullN = the number of the last change that replaced the whole 3D model (pages reload for that one).
export async function bumpRev(sql, job, full) {
  if (!job) return;
  const f = !!full;
  await sql`insert into settings(key, value) values(${'rev:' + job}, ${JSON.stringify({ n: 1, fullN: f ? 1 : 0 })}::jsonb)
    on conflict (key) do update set value = jsonb_build_object(
      'n', coalesce((settings.value->>'n')::int, 0) + 1,
      'fullN', case when ${f}::boolean then coalesce((settings.value->>'n')::int, 0) + 1 else coalesce((settings.value->>'fullN')::int, 0) end)`;
}
export async function getRev(sql, job) {
  const [r] = await sql`select value from settings where key = ${'rev:' + job}`;
  const v = (r && r.value) || {};
  return { rev: Number(v.n) || 0, fullN: Number(v.fullN) || 0 };
}
