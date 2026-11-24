// Posisi dan fase Bulan dilihat dari Bumi, rumus presisi rendah (Meeus, "Astronomical Algorithms",
// suku suku terbesarnya). Bujur meleset di bawah sekitar 1 derajat, cukup buat fase dan buat
// kelihatan kenapa gak tiap bulan baru jadi gerhana: orbit Bulan miring 5,1 derajat, jadi
// bulan baru / purnama biasanya lewat di atas atau di bawah garis Matahari Bumi
//
// Semua waktu dalam hari sejak J2000 (utils/time.js), semua sudut keluaran dalam radian.
// Bujur dan lintang ekliptika geosentris

const DEG = Math.PI / 180;

const wrap = (degrees) => ((degrees % 360) + 360) % 360;

// Bujur Matahari dilihat dari Bumi (derajat)
function sunLongitude(d) {
  const g = (357.528 + 0.9856003 * d) * DEG;
  return 280.46 + 0.9856474 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
}

// Bujur dan lintang ekliptika Bulan (radian)
export function moonPosition(d) {
  const L = 218.316 + 13.176396 * d; // bujur rata rata
  const M = (134.963 + 13.064993 * d) * DEG; // anomali rata rata Bulan
  const Ms = (357.528 + 0.9856003 * d) * DEG; // anomali rata rata Matahari
  const D = (297.85 + 12.190749 * d) * DEG; // elongasi rata rata
  const F = (93.272 + 13.22935 * d) * DEG; // argumen lintang
  const longitude =
    L +
    6.289 * Math.sin(M) + // persamaan pusat (orbit elips)
    1.274 * Math.sin(2 * D - M) + // evection
    0.658 * Math.sin(2 * D) + // variation
    0.214 * Math.sin(2 * M) -
    0.186 * Math.sin(Ms); // persamaan tahunan
  const latitude = 5.128 * Math.sin(F);
  return { longitude: wrap(longitude) * DEG, latitude: latitude * DEG };
}

// Fase: fraction = elongasi / 360 derajat (0 bulan baru, 0,5 purnama), illumination = bagian
// piringan yang terang (0 sampai 1)
export function moonPhase(d) {
  const elongation = wrap(moonPosition(d).longitude / DEG - sunLongitude(d));
  const fraction = elongation / 360;
  return { fraction, illumination: (1 - Math.cos(elongation * DEG)) / 2 };
}
