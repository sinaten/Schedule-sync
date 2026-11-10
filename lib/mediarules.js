import { db } from './db';

// How long (in minutes) people may VIEW / DELETE photos and videos after they were uploaded. null = no limit. Admins are never limited.
// Set by the admin in Admin > Photos & videos.
export const RULES_DEFAULT = { userView: null, userDelete: 1440, editorView: null, editorDelete: null };

export async function getRules() {
  const sql = await db();
  const [r] = await sql`select value from settings where key = 'media_rules'`;
  const v = (r && r.value) || {};
  const pick = (k) => {
    if (!(k in v)) return RULES_DEFAULT[k];
    if (v[k] === null) return null;
    const n = Number(v[k]);
    return Number.isFinite(n) && n >= 0 ? n : RULES_DEFAULT[k];
  };
  return { userView: pick('userView'), userDelete: pick('userDelete'), editorView: pick('editorView'), editorDelete: pick('editorDelete') };
}

// what: 'view' | 'delete'. Returns minutes or null (no limit).
export function limitFor(u, rules, what) {
  if (!u || u.role === 'admin') return null;
  const editor = u.role === 'editor';
  return what === 'view' ? (editor ? rules.editorView : rules.userView) : editor ? rules.editorDelete : rules.userDelete;
}

export const within = (created, minutes) => minutes === null || minutes === undefined || Date.now() - new Date(created).getTime() < minutes * 60000;
