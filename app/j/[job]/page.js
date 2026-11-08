import Viewer3D from '../../Viewer3D';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export default function JobPage({ params }) {
  const slug = decodeURIComponent(params.job);
  const job = slug === '_none' ? '' : slug;
  return (
    <main>
      <p><a href="/">All jobs</a></p>
      <h1>{job || 'No job number yet'}</h1>
      <Viewer3D job={job} />
    </main>
  );
}
