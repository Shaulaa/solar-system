// Galaksi kerdil anggota Grup Lokal, tahap zoom paling luar (galaxy/dwarfGalaxies.js)
//
// Sumber: katalog Nearby Galaxies McConnachie (2012, AJ 144, 4), versi Januari 2021
// (cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/community/nearby). Yang diambil semua galaksi sampai 3,6 juta
// tahun cahaya, kecuali yang di katalognya bertanda * (belum pasti galaksi, bisa jadi gugus bintang)
// dan lima galaksi besar yang sudah punya data sendiri di data/localGroup.js
//
//   [nama, ra (jam), dec (derajat), jarak (tahun cahaya), magnitudo mutlak V, jari jari setengah cahaya
//    (tahun cahaya), kaya gas]
//
// Jarak dari modulus jarak katalog, jari jari dari r_h (menit busur) di jarak itu. Magnitudo katalog
// sudah dikoreksi pemerahan debu, jadi M_V = V - (m - M). Kaya gas = massa HI paling sedikit 1 juta
// massa Matahari: galaksi kerdil tak beraturan yang masih membentuk bintang (kebiruan), sisanya
// galaksi kerdil bola dan elips yang bintangnya tua (kekuningan)

import { localGroupPosition } from './localGroup.js';

const DWARFS = [
  ['Segue 1', 10.11778, 16.082, 75_000, -1.3, 90],
  ['Sagittarius dSph', 18.92208, -30.545, 86_000, -13.5, 8560],
  ['Hydrus I', 2.49261, -79.309, 90_000, -4.7, 190],
  ['Carina III', 7.642, -57.9, 91_000, -2.4, 100],
  ['Ursa Major II', 8.85833, 63.13, 103_000, -4.2, 420],
  ['Segue 2', 2.32111, 20.175, 113_000, -1.9, 120],
  ['Carina II', 7.60711, -57.999, 118_000, -4.5, 300],
  ['Willman 1', 10.8225, 51.05, 124_000, -2.5, 90],
  ['Boötes II', 13.96667, 12.85, 136_000, -2.9, 120],
  ['Coma Berenices', 12.44972, 23.904, 142_000, -4.4, 230],
  ['Pictor II', 6.74533, -59.897, 149_000, -3.2, 160],
  ['Tucana II', 22.86531, -58.569, 188_000, -3.8, 540],
  ['Boötes I', 14.00167, 14.5, 216_000, -6.0, 710],
  ['Draco', 17.33678, 57.915, 247_000, -8.7, 710],
  ['Ursa Minor', 15.15236, 67.222, 247_000, -9.0, 1250],
  ['Sculptor', 1.00261, -33.709, 280_000, -10.8, 1000],
  ['Sextans', 10.2175, -1.615, 280_000, -9.3, 2270],
  ['Virgo I', 12.00253, 0.681, 297_000, -0.3, 150],
  ['Ursa Major I', 10.58133, 51.92, 316_000, -5.1, 770],
  ['Carina', 6.69353, -50.966, 343_000, -9.4, 1140],
  ['Aquarius II', 22.56542, -9.328, 351_000, -4.4, 520],
  ['Centaurus I', 12.639, -40.902, 380_000, -5.6, 320],
  ['Crater II', 11.82067, -18.413, 383_000, -8.2, 3480],
  ['Antlia II', 9.59244, -36.767, 430_000, -9.0, 9530],
  ['Hercules', 16.51722, 12.792, 430_000, -5.8, 750],
  ['Hydra II', 12.36169, -31.985, 438_000, -4.6, 190],
  ['Fornax', 2.66647, -34.449, 480_000, -13.5, 2570],
  ['Leo IV', 11.54917, -0.533, 503_000, -5.0, 380],
  ['Canes Venatici II', 12.95278, 34.321, 522_000, -5.2, 230],
  ['Pisces II', 22.97528, 5.953, 596_000, -4.2, 210],
  ['Leo V', 11.51933, 2.22, 639_000, -4.6, 190],
  ['Boötes IV', 15.57928, 43.726, 681_000, -4.5, 1510],
  ['Canes Venatici I', 13.46764, 33.556, 710_000, -8.6, 1840],
  ['Leo II', 11.22467, 22.152, 761_000, -9.7, 550],
  ['Cetus III', 2.08872, -4.27, 819_000, -2.5, 290],
  ['Leo I', 10.14114, 12.306, 827_000, -11.8, 790],
  ['Eridanus II', 3.73919, -43.533, 1_240_000, -7.2, 650],
  ['Phoenix', 1.85175, -44.445, 1_335_000, -9.9, 890],
  ['Leo T', 9.5815, 17.051, 1_360_000, -7.6, 490],
  ['NGC 6822', 19.74906, -14.789, 1_498_000, -15.2, 1150, true],
  ['Andromeda XVI', 0.99161, 32.377, 1_554_000, -9.0, 400],
  ['Andromeda XXIV', 1.30833, 46.366, 1_956_000, -7.6, 1200],
  ['NGC 185', 0.64944, 48.338, 2_011_000, -14.8, 1490],
  ['Andromeda XV', 1.23853, 38.117, 2_039_000, -9.4, 720],
  ['Andromeda II', 1.27494, 33.419, 2_125_000, -12.6, 3830],
  ['Andromeda XXVIII', 22.54478, 31.216, 2_155_000, -8.5, 700],
  ['Andromeda X', 1.10936, 44.804, 2_185_000, -7.5, 830],
  ['NGC 147', 0.55336, 48.509, 2_205_000, -14.6, 2030],
  ['Andromeda XXX', 0.60969, 49.647, 2_225_000, -8.0, 870],
  ['Andromeda XVII', 0.61861, 44.322, 2_374_000, -8.5, 860],
  ['Andromeda XXIX', 23.98211, 30.756, 2_385_000, -8.3, 1180],
  ['Andromeda XI', 0.77222, 33.801, 2_396_000, -6.8, 490],
  ['Andromeda XX', 0.12519, 35.132, 2_418_000, -6.1, 370],
  ['Andromeda I', 0.76106, 38.041, 2_429_000, -11.9, 2190],
  ['Andromeda III', 0.59272, 36.498, 2_440_000, -10.2, 1560],
  ['Cetus', 0.43639, -11.044, 2_463_000, -11.3, 2290],
  ['IC 1613', 1.07994, 2.118, 2_463_000, -15.2, 4880, true],
  ['Andromeda XXXI', 22.97119, 41.291, 2_474_000, -11.7, 3020],
  ['Andromeda VII', 23.44214, 50.676, 2_486_000, -13.2, 2530],
  ['Andromeda XXVI', 0.396, 47.916, 2_486_000, -7.1, 720],
  ['Andromeda IX', 0.88139, 43.196, 2_497_000, -8.1, 1820],
  ['Andromeda XXIII', 1.48939, 38.719, 2_509_000, -10.2, 3360],
  ['LGS 3', 1.06528, 21.885, 2_509_000, -10.1, 1530],
  ['Andromeda V', 1.17142, 47.628, 2_520_000, -9.5, 1030],
  ['Andromeda XXXIII', 3.02322, 40.988, 2_520_000, -10.3, 1250],
  ['Andromeda XXXII', 0.59983, 51.56, 2_532_000, -12.3, 4790],
  ['Andromeda VI', 23.86286, 24.582, 2_555_000, -11.5, 1710],
  ['Andromeda XIV', 0.85972, 29.697, 2_591_000, -8.6, 1280],
  ['IC 10', 0.33814, 59.304, 2_591_000, -15.0, 2000, true],
  ['Leo A', 9.99069, 30.746, 2_603_000, -12.1, 1630, true],
  ['M32', 0.71161, 40.865, 2_627_000, -16.4, 360],
  ['Andromeda XXV', 0.50247, 46.852, 2_651_000, -9.7, 2310],
  ['Andromeda XIX', 0.32558, 35.044, 2_676_000, -9.0, 4830],
  ['M110 (NGC 205)', 0.67281, 41.685, 2_688_000, -16.5, 1920],
  ['Andromeda XXI', 23.91325, 42.471, 2_700_000, -9.8, 2750],
  ['Andromeda XXVII', 0.62419, 45.387, 2_700_000, -7.9, 1410],
  ['Andromeda XIII', 0.86417, 33.004, 2_738_000, -6.5, 620],
  ['Tucana', 22.69711, -64.419, 2_894_000, -9.5, 930],
  ['Andromeda XXII', 1.46111, 28.09, 3_002_000, -6.8, 820],
  ['Pegasus dIrr', 23.47675, 14.743, 3_002_000, -12.2, 1830, true],
  ['Andromeda XII', 0.79083, 34.375, 3_030_000, -6.5, 1060],
  ['WLM', 0.03283, -15.461, 3_044_000, -14.2, 7630, true],
  ['Sagittarius dIrr', 19.49972, -17.681, 3_479_000, -11.5, 920, true],
  ['Aquarius (DDO 210)', 20.78106, -12.848, 3_495_000, -10.6, 1490, true]
];

// Posisi di koordinat grup `galaxy` (sama dengan galaksi Grup Lokal lain), ukuran dalam unit galaksi
// (1 unit = 100 tahun cahaya)
export function dwarfGalaxies(sunLocal) {
  return DWARFS.map(([name, ra, dec, distanceLy, absMag, halfLightLy, gasRich = false]) => ({
    name,
    absMag,
    gasRich,
    halfLight: halfLightLy / 100,
    position: localGroupPosition({ ra, dec, distanceLy }, sunLocal)
  }));
}

export const DWARF_COUNT = DWARFS.length;
