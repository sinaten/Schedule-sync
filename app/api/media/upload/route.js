import { handleUpload } from '@vercel/blob/client';
import { currentUser, canJob } from '../../../../lib/user';
import { visitsDb } from '../../../../lib/visits';
export const dynamic = 'force-dynamic';

// Direct browser -> Vercel Blob uploads. The token is only issued to a signed-in user who may use the visit's job,
// and only for a path inside that visit's folder.
export async function POST(request) {
  const body = await request.json();
  try {
    const out = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const u = await currentUser();
        if (!u) throw new Error('Login required');
        const p = JSON.parse(clientPayload || '{}');
        const sql = await visitsDb();
        const [v] = await sql`select id, job, folder from visits where id = ${String(p.visitId || '')}`;
        if (!v || !canJob(u, v.job)) throw new Error('No access to this visit');
        if (!pathname.startsWith(v.folder + '/')) throw new Error('Bad path');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ visitId: v.id }),
        };
      },
    });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
