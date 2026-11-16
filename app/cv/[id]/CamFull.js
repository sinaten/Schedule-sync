'use client';
import Viewer3D from '../../Viewer3D';

export default function CamFull({ job, viewId }) {
  return <Viewer3D job={job} kiosk={{ viewId }} />;
}
