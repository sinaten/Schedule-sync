import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QR from 'qrcode';
import { getQrConfig, sectionsDb } from '../../../lib/qrcfg';
import { findViewByQr } from '../../../lib/camviews';
export const dynamic = 'force-dynamic';

const CM = 28.3465;
const ascii = (s) => String(s).replace(/[^\x20-\x7E]/g, '?');

// Public download link (no login): a vector PDF with the QR at the size set in Admin ▸ Settings.
export async function GET(req, { params }) {
  const sql = await sectionsDb();
  const [s] = await sql`select id, job, name from sections where id = ${params.id}`;
  if (!s) return new Response('Not found', { status: 404 });
  const cfg = await getQrConfig();
  const origin = new URL(req.url).origin;
  const cv = await findViewByQr(sql, s.id); // a QR made from a saved camera view opens the model at that view
  const q = QR.create(origin + (cv ? '/cv/' : '/q/') + s.id, { errorCorrectionLevel: 'M' });
  const n = q.modules.size;
  const data = q.modules.data;
  const W = 595.28, H = 841.89;
  const size = Math.min(cfg.sizeCm, 18) * CM;
  const m = size / n;
  const x0 = (W - size) / 2;
  const y0 = H / 2 - size / 2 + 30;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (data[r * n + c]) page.drawRectangle({ x: x0 + c * m, y: y0 + size - (r + 1) * m, width: m + 0.2, height: m + 0.2, color: rgb(0, 0, 0) });
    }
  }
  if (cv) {
    const OR = rgb(0.91, 0.44, 0.04), t = 10, pad = 14;
    page.drawRectangle({ x: x0 - pad - t / 2, y: y0 - pad - t / 2 - 90, width: size + 2 * pad + t, height: size + 2 * pad + t + 90, borderColor: OR, borderWidth: t, color: undefined });
    page.drawText('CAMERA VIEW ' + (cv.view.n || ''), { x: x0 - pad + 8, y: y0 - 84, size: 13, font: reg, color: OR });
  }
  const name = ascii(s.name);
  const nameSize = 24;
  const nw = font.widthOfTextAtSize(name, nameSize);
  page.drawText(name, { x: Math.max(20, (W - nw) / 2), y: y0 - 40, size: nameSize, font, color: rgb(0, 0, 0) });
  const job = ascii(s.job);
  const jw = reg.widthOfTextAtSize(job, 14);
  page.drawText(job, { x: Math.max(20, (W - jw) / 2), y: y0 - 62, size: 14, font: reg, color: rgb(0.35, 0.35, 0.35) });
  const bytes = await pdf.save();
  const file = 'QR-' + ascii(s.name).replace(/[^\w.-]+/g, '_') + '.pdf';
  return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="' + file + '"', 'cache-control': 'no-store' } });
}
