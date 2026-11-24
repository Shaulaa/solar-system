// Gerhana yang akan datang, dipakai panel info Bulan (ui/infoPanel.js)
//
// Daftar tetap, bukan dihitung: model orbit Bulan di utils/moon.js cuma rata rata, bisa meleset
// sekitar sehari dan salah nebak gerhana yang nyaris terjadi. Gerhana Bulan penumbra (cuma meredup
// sedikit, hampir gak kelihatan) gak dimasukkan, makanya tahun 2027 gak punya gerhana Bulan.
// Di luar rentang daftar ini panel gak nampilin barisnya
//
//   date   tanggal (UTC) puncak gerhana
//   type   'total' | 'annular' (cincin) | 'partial'
//   where  wilayah jalur total (opsional, cuma gerhana Matahari total)

import { lang } from '../i18n/index.js';
import { eclipseWhere } from '../i18n/content.en.js';

export const ECLIPSE_RANGE = { from: '2026-01-01', to: '2030-12-31' };

export const solarEclipses = [
  { date: '2026-08-12', type: 'total', where: 'Greenland, Islandia, Spanyol' },
  { date: '2027-02-06', type: 'annular' },
  { date: '2027-08-02', type: 'total', where: 'Spanyol, Afrika Utara, Timur Tengah' },
  { date: '2028-01-26', type: 'annular' },
  { date: '2028-07-22', type: 'total', where: 'Australia, Selandia Baru' },
  { date: '2029-01-14', type: 'partial' },
  { date: '2029-06-12', type: 'partial' },
  { date: '2029-07-11', type: 'partial' },
  { date: '2029-12-05', type: 'partial' },
  { date: '2030-06-01', type: 'annular' },
  { date: '2030-11-25', type: 'total', where: 'Afrika bagian selatan, Australia' }
];

export const lunarEclipses = [
  { date: '2026-03-03', type: 'total' },
  { date: '2026-08-28', type: 'partial' },
  { date: '2028-01-12', type: 'partial' },
  { date: '2028-07-06', type: 'partial' },
  { date: '2028-12-31', type: 'total' },
  { date: '2029-06-26', type: 'total' },
  { date: '2029-12-20', type: 'total' },
  { date: '2030-06-15', type: 'partial' }
];

// Wilayah jalur total sesuai bahasa antarmuka
export function eclipseRegion(eclipse) {
  if (!eclipse.where) return null;
  return lang === 'en' ? eclipseWhere[eclipse.date] ?? eclipse.where : eclipse.where;
}

// Gerhana pertama di daftar pada atau setelah tanggal ISO `from`, atau null kalau `from` di luar rentang
export function nextEclipse(list, from) {
  if (from < ECLIPSE_RANGE.from || from > ECLIPSE_RANGE.to) return null;
  return list.find((eclipse) => eclipse.date >= from) ?? null;
}
