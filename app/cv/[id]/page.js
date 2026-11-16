import { notFound, redirect } from 'next/navigation';
import { db } from '../../../lib/db';
import { currentUser, canJob } from '../../../lib/user';
import { findViewByQr } from '../../../lib/camviews';
import CamFull from './CamFull';
export const dynamic = 'force-dynamic';

// Landing page of the QR of a saved camera view: the model, full screen, from the saved angle. Look only, one X to close.
export default async function CamViewPage({ params }) {
  const u = await currentUser();
  if (!u) redirect('/login');
  const sql = await db();
  const f = await findViewByQr(sql, params.id);
  if (!f) redirect('/q/' + params.id);
  if (!canJob(u, f.job)) notFound();
  return <CamFull job={f.job} viewId={f.view.id} />;
}
