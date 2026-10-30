import { db, isAddin, deny } from '../../../../lib/db';
// Add-in confirms what it wrote into Revit: { applied:[id], failed:[{id,note}] }
export async function POST(req) {
  if (!isAddin(req)) return deny();
  const { applied = [], failed = [] } = await req.json();
  const sql = await db();
  await sql`update edits set status='applied' where id in (select jsonb_array_elements_text(${JSON.stringify(applied)}::jsonb)::int)`;
  for (const f of failed) await sql`update edits set status='failed', note=${f.note || ''} where id=${f.id}`;
  return Response.json({ ok: true });
}
