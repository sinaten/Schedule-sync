// Client-side QR decoding: zxing first (handles blur / perspective much better), jsQR as a second opinion.
function sharpen(id, r, k) {
  const W = id.width, H = id.height, s = id.data, gray = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) gray[i] = s[i * 4] * 0.299 + s[i * 4 + 1] * 0.587 + s[i * 4 + 2] * 0.114;
  const tmp = new Float32Array(W * H), bl = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += gray[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = acc / (2 * r + 1);
      acc += gray[y * W + Math.min(W - 1, x + r + 1)] - gray[y * W + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      bl[y * W + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  const o = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = Math.max(0, Math.min(255, gray[i] + k * (gray[i] - bl[i])));
    o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v;
    o[i * 4 + 3] = 255;
  }
  return o;
}

export async function makeDecoder() {
  const jsQR = (await import('jsqr')).default;
  const Z = await import('@zxing/library');
  const reader = new Z.MultiFormatReader();
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.QR_CODE]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);

  function zx(rgba, w, h) {
    const lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
    try {
      const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, w, h)));
      return reader.decode(bmp).getText();
    } catch (e) { return null; }
  }

  // imageData: {data,width,height}; tick: frame counter (heavier tries on some frames)
  return function decode(imageData, tick) {
    const { data, width: w, height: h } = imageData;
    let t = zx(data, w, h);
    if (t) return { text: t, by: 'zxing' };
    const r = jsQR(data, w, h);
    if (r && r.data) return { text: r.data, by: 'jsqr' };
    if (tick % 2 === 0) {
      const k = tick % 4 === 0 ? [10, 4] : [6, 3];
      const sh = sharpen(imageData, k[0], k[1]);
      t = zx(sh, w, h);
      if (t) return { text: t, by: 'zxing+sharp' };
      const r2 = jsQR(sh, w, h);
      if (r2 && r2.data) return { text: r2.data, by: 'jsqr+sharp' };
    }
    return null;
  };
}
