import { isAddin, deny } from '../../../../lib/db';
import { db } from '../../../../lib/db';
import { ensureFolder } from '../../../../lib/folders';
import { POST as apsPost } from '../../aps/route';
export const dynamic = 'force-dynamic';

// The Revit add-in uploads the 3D model here (API key instead of the site password).
export async function POST(req) {
  if (!isAddin(req)) return deny();
  try { const b = await req.clone().json(); if (b && b.job) await ensureFolder(await db(), b.job); } catch {}
  return apsPost(req);
}
