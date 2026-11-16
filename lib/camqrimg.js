// The QR picture of a saved camera view: the QR inside an orange frame, with the numbered camera icon and the view's name under it.
// (The QR of a normal section stays plain black and white.) Browser only.
const OR = '#e8710a';
export async function camQrPng(url, n, name, qrWidth = 512) {
  const QR = (await import('qrcode')).default;
  const qrUrl = await QR.toDataURL(url, { width: qrWidth, margin: 2, errorCorrectionLevel: 'M' });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = qrUrl; });
  const fr = 20, gap = 16, cap = 96;
  const W = qrWidth + 2 * (fr + gap), H = W + cap;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = OR; rr(0, 0, W, H, 28); g.fill();
  g.fillStyle = '#fff'; rr(fr, fr, W - 2 * fr, H - 2 * fr, 14); g.fill();
  g.drawImage(img, fr + gap, fr + gap, qrWidth, qrWidth);
  // caption: camera icon with its number, then the name
  const cy = fr + gap + qrWidth + 40;
  g.save(); g.translate(fr + gap + 4, cy - 22); g.scale(1.7, 1.7);
  g.strokeStyle = OR; g.lineWidth = 1.9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.stroke(new Path2D('M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2'));
  g.stroke(new Path2D('M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0'));
  g.restore();
  if (n) {
    const bx = fr + gap + 4 + 38, by = cy + 10;
    g.fillStyle = OR; g.beginPath(); g.arc(bx, by, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '700 18px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), bx, by + 1);
  }
  g.fillStyle = '#141413'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '700 32px system-ui, sans-serif';
  let t = String(name || ''); const max = W - 2 * (fr + gap) - 96;
  while (t.length > 1 && g.measureText(t).width > max) t = t.slice(0, -1);
  if (t !== name) t += '...';
  g.fillText(t, fr + gap + 84, cy);
  g.fillStyle = OR; g.font = '600 15px system-ui, sans-serif'; g.fillText('CAMERA VIEW', fr + gap + 84, cy + 34);
  return c.toDataURL('image/png');
}
