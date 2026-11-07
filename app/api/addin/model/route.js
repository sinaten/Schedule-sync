import { isAddin, deny } from '../../../../lib/db';
import { POST as apsPost } from '../../aps/route';
export const dynamic = 'force-dynamic';

// The Revit add-in uploads the 3D model here (API key instead of the site password).
export async function POST(req) {
  if (!isAddin(req)) return deny();
  return apsPost(req);
}
