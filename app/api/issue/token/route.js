import { handleUpload } from '@vercel/blob/client';
import { currentUser, canJob } from '../../../../lib/user';
export const dynamic = 'force-dynamic';

// Direct browser -> Vercel Blob uploads for files sent in an issue's chat (any type, large videos included).
// The token is only issued to a signed-in user who may use the job, and only for a path inside that issue's folder.
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
        const job = String(p.job || ''), el = String(p.element || '');
        if (!job || !el || !canJob(u, job)) throw new Error('No access to this job');
        if (!pathname.startsWith('issues/' + job + '/' + el + '/')) throw new Error('Bad path');
        return { maximumSizeInBytes: 500 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
