'use client';
import { useEffect, useState } from 'react';
import { makeDecoder } from '../../lib/qrdecode';

const G = "111111100111111011110011001111111100000100001111110101100101000001101110101100010111110110001011101101110101111001110001100101011101101110101110000101100100001011101100000101110110110001111001000001111111101010101010101010101111111000000001000000100001110000000000101111100000011101010011101111100011101000010100011011101001101101100110100010100101000000000010100000111011101001010111100010011100101000111010100100010110000011011111101001001011110000010101001011110100111011110001000111011010010100100001110010010101100011011100111100111110110011010010110110001101001011110011011111001011101101101110110001001100101100111110110011111010100110010000110111111110000111101000111010110111100111010111100001100111100101101110100101101001100111110111010110100101110100110010100111100100110011101100101101111100010101011001111111001000000001010000000111000100010101111111100111011110101111101010110100000101000100000110011100011111101110101001011100101110111111000101110101000011111100001010010101101110101110101000101110101100100100000100000001010101111100011100111111101011101001011010100101010";

function frame(W, H, mod, blur, rot) {
  const n = 33;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, W, H);
  x.save(); x.translate(W / 2, H / 2); x.rotate(rot * Math.PI / 180);
  const S = (n + 8) * mod; x.fillStyle = '#fff'; x.fillRect(-S / 2, -S / 2, S, S); x.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (G[r * n + k] === '1') x.fillRect(-S / 2 + (4 + k) * mod, -S / 2 + (4 + r) * mod, mod + 0.01, mod + 0.01);
  x.restore();
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  const y = c2.getContext('2d', { willReadFrequently: true });
  y.filter = 'blur(' + blur + 'px)'; y.drawImage(c, 0, 0);
  return y.getImageData(0, 0, W, H);
}

export default function ScanTest() {
  const [rows, setRows] = useState(['running...']);
  useEffect(() => {
    (async () => {
      const out = [];
      try {
        const decode = await makeDecoder();
        for (const mod of [3, 4, 6]) for (const blur of [0, 2, 3, 4, 5]) for (const rot of [0, 20]) {
          const id = frame(960, 720, mod, blur, rot);
          const t = performance.now();
          const r = decode(id, 1) || decode(id, 2) || decode(id, 4);
          out.push('mod' + mod + ' blur' + blur + ' rot' + rot + ': ' + (r ? 'OK ' + r.by : 'FAIL') + ' ' + Math.round(performance.now() - t) + 'ms');
        }
      } catch (e) { out.push('ERROR ' + (e && e.message)); }
      setRows(out);
    })();
  }, []);
  return <pre id="res" style={{ padding: 16, fontSize: 12 }}>{rows.join('\n')}</pre>;
}
