import { skyDirection } from '../utils/sky.js';
import { lang, LOCALE, localize } from '../i18n/index.js';
import { stars as starsEn, starTypes, starText } from '../i18n/content.en.js';

// Bintang tetangga Matahari: semua bintang (dan sistem bintang) sampai sekitar 13 tahun cahaya,
// ditambah beberapa bintang terang terkenal yang sedikit lebih jauh (Altair, Vega, Fomalhaut,
// Pollux, Arcturus, Capella)
//
// Koordinat langit (J2000) dan jarak ditulis apa adanya biar gampang dicek ke katalog (HYG, SIMBAD).
// Akurasinya "akurat secara populer" (PRD-GALAXY bagian 8). Posisi x y z dihitung di bawah:
// koordinat ekuatorial -> koordinat galaksi di galaxyScene (utils/sky.js, matriks rotasi standar J2000)
// (pusat galaksi +X, kutub utara galaksi +Y, arah putaran galaksi / bujur 90 derajat -Z,
// lihat workers/galaxyWorker.js)
//
//   ra            asensio rekta (jam, desimal)
//   dec           deklinasi (derajat, desimal)
//   distanceLy    jarak dari Matahari (tahun cahaya)
//   spectral      kelas spektral
//   temperature   suhu permukaan bintang utama (kelvin)
//   labeled       nama ditampilkan di layar (cuma yang paling terkenal biar gak penuh)
//   fakta         opsional. Kalau kosong, fakta dibuat dari jenis bintangnya

const STARS = [
  { id: 'alpha-centauri', name: 'Alpha Centauri', ra: 14.66, dec: -60.835, distanceLy: 4.37, spectral: 'G2V + K1V', temperature: 5790, constellation: 'Centaurus', labeled: true,
    fakta: 'Sistem bintang terdekat yang kelihatan dengan mata telanjang: dua bintang mirip Matahari yang saling mengorbit tiap 80 tahun.' },
  { id: 'proxima-centauri', name: 'Proxima Centauri', ra: 14.495, dec: -62.679, distanceLy: 4.24, spectral: 'M5.5V', temperature: 3040, constellation: 'Centaurus',
    fakta: 'Bintang terdekat dari Matahari. Punya planet seukuran Bumi, Proxima b, di zona layak huninya.' },
  { id: 'barnard', name: 'Bintang Barnard', aliases: ["Barnard's Star", 'Barnard'], ra: 17.963, dec: 4.693, distanceLy: 5.96, spectral: 'M4V', temperature: 3130, constellation: 'Ophiuchus', labeled: true,
    fakta: 'Bintang dengan gerak semu tercepat di langit, bergeser selebar setengah Bulan purnama tiap sekitar 180 tahun.' },
  { id: 'wolf-359', name: 'Wolf 359', ra: 10.942, dec: 7.015, distanceLy: 7.86, spectral: 'M6V', temperature: 2800, constellation: 'Leo' },
  { id: 'lalande-21185', name: 'Lalande 21185', ra: 11.055, dec: 35.97, distanceLy: 8.31, spectral: 'M2V', temperature: 3550, constellation: 'Ursa Major' },
  { id: 'sirius', name: 'Sirius', ra: 6.752, dec: -16.716, distanceLy: 8.6, spectral: 'A1V', temperature: 9940, constellation: 'Canis Major', labeled: true,
    fakta: 'Bintang paling terang di langit malam. Ditemani Sirius B, katai putih seukuran Bumi.' },
  { id: 'luyten-726-8', name: 'Luyten 726-8', aliases: ['UV Ceti', 'BL Ceti'], ra: 1.648, dec: -17.95, distanceLy: 8.73, spectral: 'M5.5V', temperature: 2670, constellation: 'Cetus',
    fakta: 'Dua katai merah yang saling mengorbit. Salah satunya, UV Ceti, jadi contoh klasik bintang suar yang bisa mendadak terang.' },
  { id: 'ross-154', name: 'Ross 154', ra: 18.83, dec: -23.836, distanceLy: 9.69, spectral: 'M3.5V', temperature: 3240, constellation: 'Sagittarius' },
  { id: 'ross-248', name: 'Ross 248', ra: 23.698, dec: 44.175, distanceLy: 10.3, spectral: 'M5.5V', temperature: 2800, constellation: 'Andromeda' },
  { id: 'epsilon-eridani', name: 'Epsilon Eridani', ra: 3.549, dec: -9.458, distanceLy: 10.47, spectral: 'K2V', temperature: 5080, constellation: 'Eridanus', labeled: true,
    fakta: 'Bintang muda yang dikelilingi sabuk debu, gambaran kira-kira seperti apa tata surya waktu masih muda.' },
  { id: 'lacaille-9352', name: 'Lacaille 9352', ra: 23.099, dec: -35.853, distanceLy: 10.72, spectral: 'M0.5V', temperature: 3690, constellation: 'Piscis Austrinus' },
  { id: 'ross-128', name: 'Ross 128', ra: 11.795, dec: 0.8, distanceLy: 11.01, spectral: 'M4V', temperature: 3190, constellation: 'Virgo' },
  { id: 'ez-aquarii', name: 'EZ Aquarii', ra: 22.644, dec: -15.3, distanceLy: 11.11, spectral: 'M5V', temperature: 3000, constellation: 'Aquarius' },
  { id: 'procyon', name: 'Procyon', ra: 7.655, dec: 5.225, distanceLy: 11.46, spectral: 'F5IV', temperature: 6530, constellation: 'Canis Minor', labeled: true,
    fakta: 'Salah satu bintang paling terang di langit. Seperti Sirius, ditemani sebuah katai putih.' },
  { id: '61-cygni', name: '61 Cygni', ra: 21.115, dec: 38.749, distanceLy: 11.4, spectral: 'K5V + K7V', temperature: 4400, constellation: 'Cygnus',
    fakta: 'Bintang pertama yang jaraknya berhasil diukur, oleh Friedrich Bessel tahun 1838.' },
  { id: 'struve-2398', name: 'Struve 2398', ra: 18.713, dec: 59.633, distanceLy: 11.49, spectral: 'M3V + M3.5V', temperature: 3400, constellation: 'Draco' },
  { id: 'groombridge-34', name: 'Groombridge 34', ra: 0.307, dec: 44.023, distanceLy: 11.62, spectral: 'M1.5V + M3.5V', temperature: 3600, constellation: 'Andromeda' },
  { id: 'epsilon-indi', name: 'Epsilon Indi', ra: 22.057, dec: -56.786, distanceLy: 11.87, spectral: 'K5V', temperature: 4650, constellation: 'Indus',
    fakta: 'Ditemani dua katai coklat, benda yang terlalu kecil untuk jadi bintang tapi terlalu besar untuk jadi planet.' },
  { id: 'dx-cancri', name: 'DX Cancri', ra: 8.497, dec: 26.776, distanceLy: 11.83, spectral: 'M6.5V', temperature: 2840, constellation: 'Cancer' },
  { id: 'tau-ceti', name: 'Tau Ceti', ra: 1.734, dec: -15.937, distanceLy: 11.91, spectral: 'G8V', temperature: 5340, constellation: 'Cetus', labeled: true,
    fakta: 'Bintang tunggal mirip Matahari yang paling dekat. Sering jadi sasaran pencarian sinyal kehidupan cerdas.' },
  { id: 'gj-1061', name: 'GJ 1061', ra: 3.6, dec: -44.513, distanceLy: 11.98, spectral: 'M5.5V', temperature: 2950, constellation: 'Horologium' },
  { id: 'yz-ceti', name: 'YZ Ceti', ra: 1.209, dec: -16.998, distanceLy: 12.11, spectral: 'M4.5V', temperature: 3150, constellation: 'Cetus' },
  { id: 'luyten-star', name: 'Bintang Luyten', aliases: ["Luyten's Star", 'GJ 273'], ra: 7.457, dec: 5.226, distanceLy: 12.35, spectral: 'M3.5V', temperature: 3380, constellation: 'Canis Minor' },
  { id: 'teegarden', name: 'Bintang Teegarden', aliases: ["Teegarden's Star"], ra: 2.888, dec: 16.881, distanceLy: 12.5, spectral: 'M7V', temperature: 2900, constellation: 'Aries',
    fakta: 'Baru ditemukan tahun 2003 walaupun sangat dekat, karena redupnya keterlaluan.' },
  { id: 'kapteyn', name: 'Bintang Kapteyn', aliases: ["Kapteyn's Star"], ra: 5.194, dec: -45.018, distanceLy: 12.83, spectral: 'M1V', temperature: 3550, constellation: 'Pictor',
    fakta: 'Salah satu bintang tertua di sekitar Matahari. Diduga berasal dari galaksi kerdil yang dulu ditelan Bima Sakti.' },
  { id: 'lacaille-8760', name: 'Lacaille 8760', aliases: ['AX Microscopii'], ra: 21.29, dec: -38.867, distanceLy: 12.95, spectral: 'M0V', temperature: 3800, constellation: 'Microscopium' },
  { id: 'kruger-60', name: 'Kruger 60', ra: 22.467, dec: 57.696, distanceLy: 13.07, spectral: 'M3V + M4V', temperature: 3200, constellation: 'Cepheus' },
  { id: 'altair', name: 'Altair', ra: 19.846, dec: 8.868, distanceLy: 16.73, spectral: 'A7V', temperature: 7700, constellation: 'Aquila', labeled: true,
    fakta: 'Berputar sangat cepat, sekali putaran sekitar 9 jam, sampai bentuknya pepat di kutub.' },
  { id: 'vega', name: 'Vega', ra: 18.616, dec: 38.784, distanceLy: 25.04, spectral: 'A0V', temperature: 9600, constellation: 'Lyra', labeled: true,
    fakta: 'Dulu jadi patokan kecerahan nol. Sekitar 12.000 tahun lagi akan jadi bintang kutub utara.' },
  { id: 'fomalhaut', name: 'Fomalhaut', ra: 22.961, dec: -29.622, distanceLy: 25.13, spectral: 'A3V', temperature: 8590, constellation: 'Piscis Austrinus',
    fakta: 'Dikelilingi cincin debu lebar yang terpotret jelas oleh teleskop Hubble dan James Webb.' },
  { id: 'pollux', name: 'Pollux', ra: 7.755, dec: 28.026, distanceLy: 33.78, spectral: 'K0III', temperature: 4670, constellation: 'Gemini',
    fakta: 'Raksasa oranye terdekat dari Matahari, dan punya satu planet raksasa.' },
  { id: 'arcturus', name: 'Arcturus', ra: 14.261, dec: 19.182, distanceLy: 36.66, spectral: 'K1.5III', temperature: 4290, constellation: 'Bootes',
    fakta: 'Raksasa oranye dan bintang paling terang di belahan langit utara.' },
  { id: 'capella', name: 'Capella', ra: 5.278, dec: 45.998, distanceLy: 42.92, spectral: 'G3III + G0III', temperature: 4970, constellation: 'Auriga',
    fakta: 'Sebenarnya empat bintang: dua raksasa kuning yang berdekatan dan sepasang katai merah yang lebih jauh.' }
];

// Warna titik bintang per kelas spektral (dipakai galaxy/nearbyStars.js dan panel info)
export const SPECTRAL_COLOR = {
  O: '#9db4ff',
  B: '#a9c1ff',
  A: '#d5e0ff',
  F: '#f8f7ff',
  G: '#fff1d6',
  K: '#ffd2a1',
  M: '#ffb07a'
};

// Jenis bintang dari huruf kelas spektral dan kelas luminositasnya (III = raksasa)
const TYPE_LABEL = {
  O: 'Bintang biru',
  B: 'Bintang biru',
  A: 'Bintang putih',
  F: 'Bintang putih kekuningan',
  G: 'Bintang kuning',
  K: 'Katai oranye',
  M: 'Katai merah'
};

const number = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const english = lang === 'en';

function typeOf(star) {
  const letter = star.spectral[0];
  const giant = /III/.test(star.spectral);
  if (giant) {
    if (english) return { letter, label: letter === 'K' ? starTypes.giantK : starTypes.giantOther, giant };
    return { letter, label: letter === 'K' ? 'Raksasa oranye' : 'Raksasa kuning', giant };
  }
  return { letter, label: english ? starTypes[letter] : TYPE_LABEL[letter], giant };
}

// Fakta umum kalau bintangnya gak punya fakta khusus
function genericFact(star, type) {
  const d = number.format(star.distanceLy);
  if (english) {
    if (type.letter === 'M') return starText.factM(d);
    return type.letter === 'K' ? starText.factK : starText.factOther(d);
  }
  if (type.letter === 'M') {
    return `Katai merah, jenis bintang paling umum di galaksi. Terlalu redup untuk dilihat tanpa teleskop, padahal jaraknya cuma ${d} tahun cahaya.`;
  }
  if (type.letter === 'K') {
    return 'Katai oranye, sedikit lebih kecil dan lebih dingin dari Matahari, tapi umurnya jauh lebih panjang.';
  }
  return `Cahayanya butuh ${d} tahun untuk sampai ke Bumi.`;
}

export const nearbyStars = STARS.map((source) => {
  // Nama dan fakta khusus versi Inggris (i18n/content.en.js), fakta umum dibuat sesuai bahasa
  const star = localize(source, starsEn[source.id]);
  const type = typeOf(star);
  return {
    ...star,
    type: type.letter,
    giant: type.giant,
    direction: skyDirection(star.ra, star.dec),
    subtitle: english ? starText.subtitle(type.label, star.constellation) : `${type.label} di rasi ${star.constellation}`,
    info: { fakta: star.fakta ?? genericFact(star, type) }
  };
});
