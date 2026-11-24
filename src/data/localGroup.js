import { skyDirection, diskOrientation } from '../utils/sky.js';
import { localize } from '../i18n/index.js';
import { galaxies as galaxiesEn } from '../i18n/content.en.js';

// Galaksi Grup Lokal yang tampil di tahap zoom paling luar (galaxy/localGroup.js)
//
// Koordinat langit (J2000), jarak, kemiringan piringan, dan sudut posisinya ditulis apa adanya biar
// gampang dicek ke NED / SIMBAD. Posisi di galaxyScene dihitung di bawah: arah dari Matahari
// (utils/sky.js) dikali jarak, satuannya 1 unit = 100 tahun cahaya
//
//   ra, dec         pusat galaksi di langit (jam desimal, derajat desimal)
//   distanceLy      jarak dari Matahari (tahun cahaya)
//   inclination     kemiringan piringan, 0 = tampak dari atas (derajat)
//   positionAngle   arah sumbu panjang di langit, dari utara ke timur (derajat)
//   shape           bentuk partikel (workers/localGroupWorker.js), ukurannya dalam unit galaksi.
//                   luminosity = kecerahan total relatif ke Bima Sakti
//   labelPriority   label yang tabrakan di layar, yang angkanya lebih besar menang
//
// Bima Sakti ikut di daftar (milkyWay: true) cuma sebagai label dan benda yang bisa diklik di tahap
// Grup Lokal. Partikelnya tetap dari galaxyScene, posisinya pusat galaksi

const GALAXIES = [
  {
    id: 'milky-way',
    name: 'Bima Sakti',
    milkyWay: true,
    labelPriority: 5,
    subtitle: 'Galaksi tempat tata surya berada',
    galaxyType: 'Spiral berbatang',
    sunDistanceLy: 26_000,
    diameterLy: 100_000,
    stars: '100 sampai 400 miliar',
    fakta: 'Bersama Andromeda, dua galaksi terbesar di Grup Lokal. Matahari ada di lengan Orion, sekitar 26.000 tahun cahaya dari pusatnya.'
  },
  {
    id: 'andromeda',
    name: 'Andromeda',
    aliases: ['M31', 'Galaksi Andromeda', 'Andromeda Galaxy', 'NGC 224'],
    labelPriority: 4,
    ra: 0.712306,
    dec: 41.269,
    distanceLy: 2_537_000,
    inclination: 77,
    positionAngle: 38,
    constellation: 'Andromeda',
    galaxyType: 'Spiral',
    diameterLy: 152_000,
    stars: 'Sekitar 1 triliun',
    subtitle: 'Galaksi besar terdekat',
    fakta:
      'Dari tempat yang gelap kelihatan tanpa teleskop sebagai bercak cahaya samar. Sedang mendekat sekitar 110 km per detik, tapi perhitungan terbaru (2025) memberi peluang tabrakan dengan Bima Sakti cuma sekitar 50 persen dalam 10 miliar tahun ke depan.',
    shape: {
      type: 'spiral',
      count: 60_000,
      luminosity: 1.4,
      radius: 760,
      scale: 175,
      thickness: 6,
      bulge: { share: 0.22, spread: 38 },
      arms: { count: 2, pitch: 8, share: 0.4, rStart: 110, width: 1.1 },
      halo: 0.03
    }
  },
  {
    id: 'triangulum',
    name: 'Triangulum',
    aliases: ['M33', 'Galaksi Triangulum', 'Triangulum Galaxy', 'NGC 598'],
    labelPriority: 3,
    ra: 1.564139,
    dec: 30.66,
    distanceLy: 2_730_000,
    inclination: 55,
    positionAngle: 23,
    constellation: 'Triangulum',
    galaxyType: 'Spiral',
    diameterLy: 61_000,
    stars: 'Sekitar 40 miliar',
    subtitle: 'Galaksi spiral terkecil di Grup Lokal',
    fakta:
      'Di langit yang sangat gelap bisa dilihat mata telanjang. Punya NGC 604, awan pembentuk bintang raksasa selebar sekitar 1.500 tahun cahaya.',
    shape: {
      type: 'spiral',
      count: 18_000,
      luminosity: 0.15,
      radius: 300,
      scale: 60,
      thickness: 3,
      bulge: { share: 0.06, spread: 10 },
      arms: { count: 2, pitch: 20, share: 0.5, rStart: 25, width: 1.4 },
      halo: 0
    }
  },
  {
    id: 'lmc',
    name: 'Awan Magellan Besar',
    aliases: ['Large Magellanic Cloud', 'LMC', 'Magellan'],
    labelPriority: 2,
    ra: 5.392917,
    dec: -69.756,
    distanceLy: 163_000,
    inclination: 35,
    positionAngle: 170,
    constellation: 'Dorado dan Mensa',
    galaxyType: 'Spiral Magellan (tak beraturan berbatang)',
    diameterLy: 32_000,
    stars: 'Sekitar 30 miliar',
    subtitle: 'Galaksi satelit Bima Sakti',
    fakta:
      'Dari Indonesia kelihatan tanpa teleskop, rendah di langit selatan. Di dalamnya ada Nebula Tarantula, daerah pembentukan bintang paling aktif di Grup Lokal.',
    shape: {
      type: 'irregular',
      count: 16_000,
      luminosity: 0.1,
      radius: 110,
      scale: 38,
      thickness: 4,
      stretch: 1.1,
      bar: { share: 0.22, halfLength: 32, width: 7, offset: [-10, 6] },
      clumps: { count: 18, share: 0.2 },
      nebula: { share: 0.025, at: [26, -24] }
    }
  },
  {
    id: 'smc',
    name: 'Awan Magellan Kecil',
    aliases: ['Small Magellanic Cloud', 'SMC', 'Magellan'],
    labelPriority: 1,
    ra: 0.879111,
    dec: -72.829,
    distanceLy: 200_000,
    inclination: 65,
    positionAngle: 45,
    constellation: 'Tucana',
    galaxyType: 'Galaksi kerdil tak beraturan',
    diameterLy: 19_000,
    stars: 'Beberapa ratus juta',
    subtitle: 'Galaksi satelit Bima Sakti',
    fakta:
      'Bentuknya acak karena ditarik gravitasi Awan Magellan Besar dan Bima Sakti. Dua awan Magellan dihubungkan jembatan gas yang disebut Jembatan Magellan.',
    shape: {
      type: 'irregular',
      count: 7_000,
      luminosity: 0.03,
      radius: 60,
      scale: 20,
      thickness: 7,
      stretch: 1.8,
      bar: { share: 0.3, halfLength: 22, width: 6, offset: [0, 0] },
      clumps: { count: 10, share: 0.2 },
      nebula: { share: 0.01, at: [-12, 4] }
    }
  }
];

const LY_PER_UNIT = 100;

// Posisi di koordinat grup `galaxy` (galaxy/galaxyScene.js): pusat galaksi di (0,0,0), Matahari di
// sunLocal. Grup itu gak ikut berputar bersama isi Bima Sakti, jadi galaksi lain diam di tempatnya
export function localGroupPosition(galaxy, sunLocal) {
  if (galaxy.milkyWay) return [0, 0, 0];
  const direction = skyDirection(galaxy.ra, galaxy.dec);
  const distance = galaxy.distanceLy / LY_PER_UNIT;
  return [0, 1, 2].map((k) => sunLocal[k] + direction[k] * distance);
}

export const localGroup = GALAXIES.map((source) => localize(source, galaxiesEn[source.id])).map((galaxy) => ({
  ...galaxy,
  orientation: galaxy.milkyWay
    ? null
    : diskOrientation(galaxy.ra, galaxy.dec, galaxy.positionAngle, galaxy.inclination),
  info: { fakta: galaxy.fakta }
}));

// Galaksi kerdil anggota Grup Lokal: bercak redup tanpa label, biar kelihatan Grup Lokal itu dua
// kerumunan (di sekitar Bima Sakti dan di sekitar Andromeda), bukan cuma beberapa galaksi besar.
// [nama, ra (jam), dec (derajat), jarak (tahun cahaya), jari jari (unit galaksi)].
// Kecerahannya dilebihkan (lihat workers/localGroupWorker.js), yang asli kebanyakan gak akan kelihatan
const DWARFS = [
  ['M32', 0.71161, 40.865, 2_490_000, 32],
  ['M110', 0.67281, 41.685, 2_690_000, 60],
  ['NGC 185', 0.64944, 48.338, 2_080_000, 40],
  ['NGC 147', 0.55336, 48.509, 2_530_000, 50],
  ['Andromeda I', 0.76106, 38.041, 2_400_000, 15],
  ['Andromeda II', 1.27494, 33.419, 2_200_000, 15],
  ['IC 10', 0.33814, 59.304, 2_200_000, 25],
  ['IC 1613', 1.07994, 2.118, 2_380_000, 50],
  ['Cetus', 0.43639, -11.044, 2_480_000, 15],
  ['Pegasus dIrr', 23.47672, 14.743, 3_000_000, 20],
  ['WLM', 0.03283, -15.461, 3_040_000, 40],
  ['Leo A', 9.99069, 30.746, 2_600_000, 25],
  ['Aquarius', 20.78106, -12.848, 3_200_000, 12],
  ['Tucana', 22.69711, -64.419, 2_870_000, 10],
  ['Phoenix', 1.85175, -44.445, 1_440_000, 12],
  ['NGC 6822', 19.74906, -14.789, 1_600_000, 35],
  ['Leo I', 10.14114, 12.306, 820_000, 10],
  ['Leo II', 11.22467, 22.152, 690_000, 6],
  ['Fornax', 2.66647, -34.449, 460_000, 15],
  ['Carina', 6.69353, -50.966, 330_000, 6],
  ['Sculptor', 1.00261, -33.709, 290_000, 10],
  ['Sextans', 10.2175, -1.615, 290_000, 10],
  ['Draco', 17.33678, 57.915, 260_000, 6],
  ['Ursa Minor', 15.15236, 67.223, 200_000, 6],
  ['Sagitarius', 18.92208, -30.545, 65_000, 50]
];

export function dwarfGalaxies(sunLocal) {
  return DWARFS.map(([name, ra, dec, distanceLy, radius]) => ({
    name,
    radius,
    position: localGroupPosition({ ra, dec, distanceLy }, sunLocal)
  }));
}
