// Undo switch: SWAP = true  -> the full-screen card of the Issues list uses the Follow-up format (issue + action plan stacked on the left, the 3D model on the right)
//                              and the Follow-up card uses the Issues-list format (issue and action plan side by side, no model).
//              SWAP = false -> everything as it was before.
export const SWAP = true;
export const fsBody = (on, wide) => (on ? (wide ? { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' } : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }) : { display: 'contents' });
export const fsTop = (on, wide) => (on ? (wide ? { display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: '1.5px solid #cdb893' } : { display: 'flex', flexDirection: 'column', flex: '0.85 1 0', minHeight: 0, minWidth: 0, overflowY: 'auto' }) : { display: 'contents' });
export const fsHalf = (on, wide, kind) => (on ? wide ? { flex: (kind === 'issue' ? '0.85' : '1.15') + ' 1 0', minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' } : { flex: '0 0 auto', minWidth: 0, overflowX: 'hidden' } : {});
// Undo switch for the second, independent model viewer fixed beside the Issues list (tablet landscape and desktop). false = it does not exist.
export const SECOND = true;
// A wide, landscape screen (tablet landscape, desktop).
export const miniInline = () => typeof window !== 'undefined' && window.innerWidth >= 900 && window.innerWidth > window.innerHeight;
