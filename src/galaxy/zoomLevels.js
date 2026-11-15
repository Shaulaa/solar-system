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

// 10 (sekitar 1580 unit galaksi dari pusat pandang) biar galaksi utuh di tengah layar 16:9 waktu dilihat
// dari atas. Di 9,8 kamera cuma sekitar 1000 unit dan piringan selebar 1040 unit kepotong atas bawah
export const MAX_ZOOM_LEVEL = 10;

// Satuan galaxyScene: 1 unit = 100 tahun cahaya, galaksi berdiameter sekitar 1.000 unit
export const AU_PER_LIGHT_YEAR = 63_241;
export const LIGHT_YEARS_PER_UNIT = 100;
export const AU_PER_GALAXY_UNIT = AU_PER_LIGHT_YEAR * LIGHT_YEARS_PER_UNIT;

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
  // Titik bintang Matahari (scene tata surya) diganti penanda "Kamu di sini" (galaxyScene).
  // Selesai memudar di 6,5, sebelum jalur kamera galaksi mulai belok (galaxyTilt), karena setelah itu
  // kamera galaksi gak lagi sejajar dengan kamera tata surya
  sunStarOut: { start: 5.8, end: 6.5 },
  youAreHere: { start: 5.8, end: 6.6 },
  // Cincin dan label "Kamu di sini" baru muncul waktu piringan galaksi sudah kelihatan mengelilingi
  // Matahari (dicek dari jalur kamera default 1366x768: di 8,2 piringannya masih pita di pojok dan
  // penandanya mengambang, di 8,7 bintang piringan sudah ke segala arah). Sebelumnya cuma titik
  // Matahari yang tampil, jadi posisi "rumah" tetap kelihatan tanpa penanda besar di ruang kosong
  youAreHereRing: { start: 8.6, end: 9.0 },
  // Bintang tetangga (sampai sekitar 43 tahun cahaya). Mulai muncul waktu kamera sekitar 0,16 tahun
  // cahaya dari Matahari, memudar waktu semuanya sudah numpuk jadi satu titik di dekat Matahari
  nearbyStarsIn: { start: 4, end: 4.6 },
  nearbyStarsOut: { start: 6.6, end: 7.2 },
  // Partikel galaksi muncul, gantian dengan latar lama yang memudar.
  // Dari dalam piringan galaksi partikelnya kelihatan sebagai pita Bima Sakti di langit
  galaxyIn: { start: 3, end: 4 },
  // Lapisan tekstur ilustrasi galaksi (2048 px). Satu texel-nya sekitar 0,62 unit (62 tahun cahaya),
  // jadi baru boleh kelihatan kalau satu texel di layar sekitar 2 px atau kurang (kamera minimal
  // sekitar 253 unit dari Matahari, zoomLevel sekitar 9,2). Lebih dekat dari itu teksturnya jadi kabut
  // buram dan detail tajamnya diurus partikel
  galaxyTexture: { start: 8.9, end: 9.5 },
  // Bloom pindah dari setelan tata surya (glow Matahari) ke setelan galaksi
  galaxyBloom: { start: 4, end: 6.5 },
  // Jalur kamera galaksi waktu zoom keluar (zoom masuk membalik jalurnya, karena semuanya fungsi
  // dari zoomLevel): arah kamera pelan pelan naik ke tampilan atas yang sedikit serong.
  // Perpindahan pusat pandang dari Matahari ke pusat galaksi diatur dari jarak kamera, lihat
  // CENTER_FOLLOW di galaxy/galaxyScene.js
  galaxyTilt: { start: 6.5, end: 9.3 }
};

// Partikel galaksi baru di-generate (di worker) waktu zoomLevel pertama kali lewat angka ini
export const GALAXY_GENERATE_AT = 3;
// Lapisan tekstur galaksi baru dimuat setelah partikel siap DAN zoomLevel lewat angka ini.
// Dibutuhkannya baru di sekitar 8,9. Kalau dimuat bareng partikel, alokasi teksturnya jatuh di frame
// yang sama dengan frame pertama partikel digambar dan satu frame macet sekitar 65 ms (terukur)
export const GALAXY_TEXTURE_LOAD_AT = 6;

// Nama tahap yang ditampilkan ke user (ui/stageName.js). Batasnya dipilih dari apa yang kelihatan:
// bintang tetangga baru jelas sekitar 4,3 (nearbyStarsIn), dan bentuk galaksi mulai terbaca waktu
// bintang tetangga memudar (nearbyStarsOut)
export const ZOOM_STAGES = [
  { id: 'solar', name: 'Tata Surya', note: 'Satu bintang, delapan planet' },
  { id: 'neighbors', name: 'Lingkungan Bintang Terdekat', note: 'Bintang dalam radius sekitar 40 tahun cahaya', from: 4.3 },
  { id: 'galaxy', name: 'Galaksi Bima Sakti', note: '100 sampai 400 miliar bintang', from: 7 }
];

// Tombol "Kembali ke Tata Surya" muncul di atas angka ini (PRD-GALAXY bagian 4)
export const BACK_BUTTON_AT = 2.5;
// Di atas angka ini kontrol khusus tata surya (kecepatan waktu, orbit, mode skala) dimatikan.
// Di zoomLevel 3 planet dan orbit sudah setengah memudar (solarFade)
export const SOLAR_CONTROLS_UNTIL = 3;
// Lebar pita hysteresis di sekitar tiap batas, biar UI gak kedip waktu zoom bolak balik di batasnya
export const STAGE_HYSTERESIS = 0.15;

// Penentu "sekarang di sisi mana dari tiap batas" dengan hysteresis: pindah naik baru setelah
// zoomLevel lewat batas + band, pindah turun baru setelah di bawah batas - band.
// boundaries harus urut naik. update() balikin indeks 0 sampai boundaries.length
export function createStageTracker(boundaries, band = STAGE_HYSTERESIS) {
  let index = 0;
  return {
    update(zoomLevel) {
      while (index < boundaries.length && zoomLevel >= boundaries[index] + band) index++;
      while (index > 0 && zoomLevel < boundaries[index - 1] - band) index--;
      return index;
    },
    get index() {
      return index;
    }
  };
}

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

// Jari jari bingkai galaksi utuh (unit galaksi): piringan sekitar 540 plus ruang di tepi
const GALAXY_FRAME_RADIUS = 600;

// Faktor jarak kamera galaksi di zoom maksimal, dihitung dari sisi layar terpendek supaya galaksi
// utuh muat. Di layar lebar (16:9) yang membatasi tinggi layar, dan jarak di zoomLevel maksimal
// (sekitar 1580 unit) sudah cukup, jadi faktornya 1. Di portrait yang membatasi lebar layar
// (sudut pandang horizontalnya sempit), jadi kamera mundur sebanding.
// Faktor fit tata surya (scene/scaleMode.js) gak dipakai di sini: rumusnya dibuat buat orbit
// Neptunus, di 390x844 bikin galaksi terlalu kecil (kamera sekitar 4900 unit)
export function galaxyViewFit(aspect, fov) {
  const tanHalf = Math.tan((fov * Math.PI) / 360) * Math.min(aspect, 1);
  const needed = GALAXY_FRAME_RADIUS / tanHalf;
  const atMax = auToGalaxyUnits(zoomLevelToAU(MAX_ZOOM_LEVEL));
  return Math.max(1, needed / atMax);
}
