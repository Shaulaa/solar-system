// Waktu simulasi
//
// simDays = 0 berarti tengah malam hari ini (waktu lokal), lalu maju sesuai kecepatan simulasi.
// Toolbar pakai ini buat nampilin tanggal, orbit planet pakai ini buat ngitung posisi asli
// planet di tanggal tersebut

const MS_PER_DAY = 86_400_000;

// J2000.0 = 1 Januari 2000 jam 12:00 UTC, titik acuan elemen orbit di data/planets.js
const J2000 = Date.UTC(2000, 0, 1, 12);

const now = new Date();
const start = { year: now.getFullYear(), month: now.getMonth(), date: now.getDate() };

// Tanggal kalender untuk simDays tertentu.
// Dihitung lewat new Date(tahun, bulan, tanggal + n), bukan tambah milidetik,
// biar gak meleset sehari di negara yang pakai daylight saving time
export function simDate(simDays) {
  return new Date(start.year, start.month, start.date + Math.floor(simDays));
}

// Jumlah hari dari J2000 sampai awal simulasi (tengah malam hari ini)
export const START_DAYS_SINCE_J2000 =
  (new Date(start.year, start.month, start.date).getTime() - J2000) / MS_PER_DAY;

// simDays untuk satu saat tertentu (Date / milidetik UTC), termasuk jamnya
export function simDaysAt(moment) {
  return (new Date(moment).getTime() - J2000) / MS_PER_DAY - START_DAYS_SINCE_J2000;
}

// Saat simulasi (Date, termasuk jamnya) untuk simDays tertentu, kebalikan simDaysAt
export function simMoment(simDays) {
  return new Date(J2000 + (START_DAYS_SINCE_J2000 + simDays) * MS_PER_DAY);
}

// Kebalikan simDate: tanggal kalender (tahun, bulan 1 sampai 12, tanggal) ke simDays
export function daysFromStart(year, month, date) {
  return Math.round((Date.UTC(year, month - 1, date) - Date.UTC(start.year, start.month, start.date)) / MS_PER_DAY);
}

// Rentang pemilih tanggal. Elemen orbit J2000 di data/planets.js cuma dimaksudkan buat sekitar
// 1800 sampai 2050 (JPL), di luar 1900 sampai 2100 posisi planetnya makin meleset
export const DATE_RANGE = { min: '1900-01-01', max: '2100-12-31' };

// Tanggal kalender lokal sebagai "YYYY-MM-DD" (format nilai input type="date" dan atribut datetime)
export function isoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${month}-${day}`;
}

// "YYYY-MM-DD" ke { year, month (1 sampai 12), date }. null kalau formatnya salah, tanggalnya
// gak ada di kalender (31 Februari), atau di luar DATE_RANGE
export function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof value === 'string' ? value : '');
  if (!match || value < DATE_RANGE.min || value > DATE_RANGE.max) return null;
  const [year, month, date] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, date));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) return null;
  return { year, month, date };
}
