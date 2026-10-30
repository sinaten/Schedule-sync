import { db } from '../../../lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  const sql = await db();
  return Response.json(await sql`select id, name, updated_at from schedules order by name`);
}
