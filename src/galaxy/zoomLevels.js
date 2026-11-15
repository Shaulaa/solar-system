import { planets as planetData } from '../data/planets.js';
import { scaleDistance, unscaleDistance, blendScale } from '../utils/scale.js';

// Satu nilai zoomLevel jadi sumber kebenaran semua transisi tata surya ke galaksi
//
//   zoomLevel = log10(jarak kamera ke Matahari dalam AU)
//
//   0 sampai 2     tata surya
//   2 sampai 4     orbit, label, dan planet memudar, Matahari jadi bintang
//   4 sampai 6,5   bintang tetangga
//   6,5 ke atas    galaksi Bima Sakti
//
// Kamera tata surya cuma bisa mundur sampai batas maxDistance. Lewat dari situ zoom ditambah
// secara virtual (offset, lihat createVirtualZoom di controls/cameraRig.js): kamera diam,
// isi tata surya yang mengecil. Jadi zoomLevel = zoom dari jarak kamera asli + offset

export const MAX_ZOOM_LEVEL = 9.8;

// Satuan galaxyScene: 1 unit = 100 tahun cahaya, galaksi berdiameter sekitar 1.000 unit
export const AU_PER_LIGHT_YEAR = 63_241;
export const LIGHT_YEARS_PER_UNIT = 100;
const AU_PER_GALAXY_UNIT = AU_PER_LIGHT_YEAR * LIGHT_YEARS_PER_UNIT;

// Rentang [start, end] tiap transisi. Opacity dihitung pakai fadeBetween(zoomLevel, start, end)
export const STAGES = {
  // Garis orbit, label, planet, bulan, dan sabuk asteroid memudar ke 0
  solarFade: { start: 2, end: 4 },
  // Latar lama (bintang kelap kelip dan sphere Bima Sakti) memudar, nanti digantikan galaxyScene
  backdropFade: { start: 2, end: 4 },
  // Bola Matahari diganti titik bintang. Bintangnya muncul waktu bola Matahari di mode
  // Enak Dilihat tinggal sekitar 3 px (zoomLevel 2,66 di layar 1080 px), bolanya memudar sesudahnya
  sunStarIn: { start: 2.3, end: 2.9 },
  sunBodyOut: { start: 2.5, end: 3.1 },
  // Titik bintang Matahari 6 px kebesaran buat skala galaksi. Sementara dipudarkan di tahap galaksi,
  // penggantinya penanda "Kamu di sini" (tahap G4)
  sunStarOut: { start: 6.5, end: 7.5 },
  // Partikel galaksi muncul, gantian dengan latar lama yang memudar.
  // Dari dalam piringan galaksi partikelnya kelihatan sebagai pita Bima Sakti di langit
  galaxyIn: { start: 3, end: 4 }
};

// Partikel galaksi baru di-generate (di worker) waktu zoomLevel pertama kali lewat angka ini
export const GALAXY_GENERATE_AT = 3;

// 0 di bawah start, 1 di atas end, di antaranya smoothstep biar awal dan akhirnya halus
export function fadeBetween(zoomLevel, start, end) {
  const t = Math.min(Math.max((zoomLevel - start) / (end - start), 0), 1);
  return t * t * (3 - 2 * t);
}

// Batas bawah biar log10 gak pernah ketemu 0 (kamera di dalam Matahari waktu fokus ke Matahari)
const MIN_AU = 1e-3;
const NEPTUNE_AU = planetData[planetData.length - 1].distance;

// Jarak kamera ke Matahari (unit scene) ke AU, untuk mode skala k mana pun (0 pretty, 1 real).
// Di dalam orbit Neptunus pakai kebalikan rumus utils/scale.js. Di luar Neptunus jaraknya
// dianggap linier dalam AU, disambung dari titik Neptunus biar gak ada lompatan.
// Selama transisi skala (0 < k < 1) dipakai interpolasi geometris dari dua kebalikannya.
// Itu cuma perkiraan, tapi cukup karena zoom virtual dikunci selama transisi
export function solarDistanceToAU(units, k = 0) {
  const neptune = blendScale(scaleDistance(NEPTUNE_AU), scaleDistance(NEPTUNE_AU, 'real'), k);
  if (units >= neptune) return (NEPTUNE_AU * units) / neptune;
  if (k <= 0) return unscaleDistance(units);
  if (k >= 1) return unscaleDistance(units, 'real');
  const pretty = Math.max(unscaleDistance(units), MIN_AU);
  const real = Math.max(unscaleDistance(units, 'real'), MIN_AU);
  return blendScale(pretty, real, k);
}

// fit = seberapa jauh kamera overview mundur di layar sempit (scene/scaleMode.js).
// Jaraknya dibagi fit dulu, jadi tampilan yang sama di layar mana pun dapat zoomLevel yang sama.
// Tanpa ini, di HP portrait (kamera mundur sampai 3x) orbit sudah ikut memudar di tampilan overview
export function zoomLevelAt({ distance, k = 0, fit = 1, offset = 0 }) {
  const au = Math.max(solarDistanceToAU(distance, k), MIN_AU);
  return Math.log10(au / fit) + offset;
}

// Jarak kamera asli (sebelum dibagi fit) dalam AU untuk zoomLevel tertentu
export function zoomLevelToAU(zoomLevel, fit = 1) {
  return Math.pow(10, zoomLevel) * fit;
}

export function auToGalaxyUnits(au) {
  return au / AU_PER_GALAXY_UNIT;
}
