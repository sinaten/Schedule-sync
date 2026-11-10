import { notFound } from 'next/navigation';
import Viewer3D from '../../Viewer3D';
import MediaGrid from '../../MediaGrid';
import { currentUser, canJob } from '../../../lib/user';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export default async function JobPage({ params }) {
  const slug = decodeURIComponent(params.job);
  const job = slug === '_none' ? '' : slug;
  if (!canJob(await currentUser(), job)) notFound();
  return (
    <main>
      <p><a href="/">All jobs</a></p>
      <h1>{job || 'No job number yet'}</h1>
      <Viewer3D job={job} />
      {job && (
        <>
          <h2>Photos &amp; videos</h2>
          <MediaGrid job={job} />
        </>
      )}
    </main>
  );
}
