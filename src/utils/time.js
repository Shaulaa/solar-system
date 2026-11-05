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
