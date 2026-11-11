import { db } from './db';

// Per-person permissions set by the admin in Admin > Settings > User access. Admins can always do everything.
// A box that is not ticked means "not allowed".
export const PERMS = [['model3d', 'Edit 3D model']];

export async function getPerms() {
  const sql = await db();
  const [r] = await sql`select value from settings where key = 'user_perms'`;
  return (r && r.value) || {};
}

export const canDo = (u, perm, all) => !!u && (u.role === 'admin' || !!(all[u.name] && all[u.name][perm]));
