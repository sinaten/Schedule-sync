import { db } from './db';

// Which Yes/No columns each person may change on the website. Set in the Revit add-in (SINA-TAEIDI > Site access); the same for every project.
// A person with an entry is limited to exactly those columns (even an editor). A person with no entry keeps the old rule: admins and editors edit everything, everyone else only looks.
export async function getColPerms() {
  const sql = await db();
  const [r] = await sql`select value from settings where key = 'col_perms'`;
  return (r && r.value) || {};
}

// null = old rule applies; an array = only these column names may be changed
export function allowedCols(u, perms) {
  if (!u) return null;
  const l = perms[u.name];
  return Array.isArray(l) ? l : null;
}
