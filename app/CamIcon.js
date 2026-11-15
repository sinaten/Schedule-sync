// The numbered camera that stands for a saved view: a small camera, the same height as the letters, with its number in a badge. Used inside Issue text and in the lists.
export default function CamIcon({ n }) {
  return (
    <span aria-hidden="true" style={{ position: 'relative', display: 'inline-block', width: '1.3em', height: '1em', verticalAlign: '-0.18em', margin: '0 0.12em' }}>
      <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="#e8710a" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 0, top: '-0.08em' }}>
        <path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
        <path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      </svg>
      {n ? <b style={{ position: 'absolute', right: '-0.15em', bottom: '-0.28em', minWidth: '0.95em', height: '0.95em', padding: '0 0.1em', boxSizing: 'border-box', borderRadius: '0.5em', background: '#e8710a', color: '#fff', fontSize: '0.62em', fontWeight: 600, lineHeight: '0.95em', textAlign: 'center' }}>{n}</b> : null}
    </span>
  );
}
