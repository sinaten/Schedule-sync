import { db } from './db';

// Who may see which part of the site. Admins always see everything. Set by the admin in Admin > Settings > Access.
export const FEATURES = [['analysis', 'Analysis']];
export const ACCESS_DEFAULT = { analysis: { editor: true, viewer: false } };

export async function getAccess() {
  const sql = await db();
  const [r] = await sql`select value from settings where key = 'access'`;
  const v = (r && r.value) || {};
  const out = {};
  for (const [k] of FEATURES) {
    const d = ACCESS_DEFAULT[k];
    const s = v[k] || {};
    out[k] = { editor: 'editor' in s ? !!s.editor : d.editor, viewer: 'viewer' in s ? !!s.viewer : d.viewer };
  }
  return out;
}

export const canSee = (u, feature, access) => !!u && (u.role === 'admin' || !!(access[feature] && access[feature][u.role]));
