import { db } from './db';

export const QR_DEFAULT = { nameParam: 'QR name', codeParam: 'QR code', sizeCm: 6 };

export async function getQrConfig() {
  const sql = await db();
  const [r] = await sql`select value from settings where key = 'qr_config'`;
  const v = (r && r.value) || {};
  const size = Number(v.sizeCm);
  return {
    nameParam: String(v.nameParam || QR_DEFAULT.nameParam),
    codeParam: String(v.codeParam || QR_DEFAULT.codeParam),
    sizeCm: size >= 2 && size <= 18 ? size : QR_DEFAULT.sizeCm,
  };
}

export async function sectionsDb() {
  const sql = await db();
  await sql`create table if not exists sections(id text primary key, job text not null, name text not null, pos int default 0, created_at timestamptz default now())`;
  return sql;
}
