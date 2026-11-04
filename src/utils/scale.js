// Dua mode skala tata surya
//
// pretty (Enak Dilihat, default)
//   Ukuran asli bikin planet cuma jadi titik, jadi jarak dan radius dikompres pake pangkat 0.55
// real (Skala Nyata)
//   Perbandingan asli. 1 AU = 400 unit, dan radius dihitung pakai satuan yang SAMA
//   (radius Matahari 696.340 km jadi sekitar 1,86 unit, Bumi sekitar 0,017 unit)
//
// Semua modul scene minta ukuran lewat fungsi di sini dengan parameter mode,
// jadi rumusnya cuma ditulis sekali

const KM_PER_AU = 149_597_870.7;
const EARTH_RADIUS_KM = 6371;
const SUN_RADIUS_KM = 696_340;
const REAL_UNITS_PER_AU = 400;

const kmToRealUnits = (km) => (km / KM_PER_AU) * REAL_UNITS_PER_AU;

const PRETTY_SUN_RADIUS = 6;

const MODES = {
  pretty: {
    sunRadius: PRETTY_SUN_RADIUS,
    distance: (au) => PRETTY_SUN_RADIUS + 8 + 22 * Math.pow(au, 0.55),
    radius: (earthRadius) => 0.9 * Math.pow(earthRadius, 0.55)
  },
  real: {
    sunRadius: kmToRealUnits(SUN_RADIUS_KM),
    distance: (au) => au * REAL_UNITS_PER_AU,
    radius: (earthRadius) => kmToRealUnits(earthRadius * EARTH_RADIUS_KM)
  }
};

export const SCALE_MODES = Object.keys(MODES);

// Radius matahari mode default, geometry matahari dibuat pakai angka ini
export const SUN_RADIUS = PRETTY_SUN_RADIUS;

export function sunRadius(mode = 'pretty') {
  return MODES[mode].sunRadius;
}

export function scaleDistance(au, mode = 'pretty') {
  return MODES[mode].distance(au);
}

export function scaleRadius(earthRadius, mode = 'pretty') {
  return MODES[mode].radius(earthRadius);
}

// Jarak dalam km ke unit skala nyata (dipakai jarak orbit bulan)
export function scaleKm(km) {
  return kmToRealUnits(km);
}

// Interpolasi antar mode. k = 0 berarti pretty, k = 1 berarti real.
// Dipakai interpolasi geometris (bukan linear) karena bedanya sampai puluhan kali lipat.
// Kalau linear, hampir semua perubahan kelihatan numpuk di awal transisi
export function blendScale(prettyValue, realValue, k) {
  return prettyValue * Math.pow(realValue / prettyValue, k);
}
