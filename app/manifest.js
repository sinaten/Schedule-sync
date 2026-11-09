// Lets the site be installed on a phone like an app (Add to Home Screen).
export default function manifest() {
  return {
    name: 'Schedule Sync',
    short_name: 'Schedule Sync',
    description: 'Revit schedules and 3D models',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#16262e',
    theme_color: '#16262e',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
