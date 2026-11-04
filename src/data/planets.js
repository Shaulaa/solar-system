// Data planet tata surya
// radius relatif ke Bumi, distance dalam AU, periode dalam hari (Bumi), tilt dalam derajat
// rotationPeriod negatif artinya rotasinya kebalik (retrograde)
//
// Panel info (ui/infoPanel.js) baca semua isinya dari sini.
// Angka seperti distance, orbitPeriod, rotationPeriod, dan tilt diformat otomatis
// (AU ke juta km, hari ke tahun / jam), jadi gak perlu ditulis ulang sebagai teks.
// subtitle cuma diisi kalau gak bisa diturunkan (planet otomatis "Planet ke N dari Matahari")

export const planets = [
  {
    id: 'mercury',
    name: 'Merkurius',
    radius: 0.383,
    distance: 0.387,
    orbitPeriod: 88,
    rotationPeriod: 58.6,
    tilt: 0.03,
    texture: '2k_mercury.jpg',
    look: { type: 'rocky', colors: ['#5a5550', '#8c8680', '#b5ada4'] },
    info: {
      diameter: '4.879 km',
      suhu: '-173°C sampai 427°C',
      bulan: 0,
      fakta: 'Planet terkecil dan paling dekat sama Matahari, tapi bukan yang paling panas.'
    }
  },
  {
    id: 'venus',
    name: 'Venus',
    radius: 0.949,
    distance: 0.723,
    orbitPeriod: 224.7,
    rotationPeriod: -243,
    tilt: 177.4,
    texture: '2k_venus_atmosphere.jpg',
    look: { type: 'cloudy', colors: ['#a8783a', '#d9b26f', '#f0d9a0'] },
    info: {
      diameter: '12.104 km',
      suhu: '464°C rata rata',
      bulan: 0,
      fakta: 'Satu hari di Venus lebih lama dari satu tahunnya.'
    }
  },
  {
    id: 'earth',
    name: 'Bumi',
    radius: 1,
    distance: 1,
    orbitPeriod: 365.25,
    rotationPeriod: 1,
    tilt: 23.4,
    // Bumi punya 3 tekstur, dipakai sama scene/earth.js (permukaan siang malam + awan)
    texture: {
      day: '2k_earth_daymap.jpg',
      night: '2k_earth_nightmap.jpg',
      clouds: '2k_earth_clouds.jpg'
    },
    look: { type: 'earth', colors: ['#0b2a5c', '#1d5fa8', '#3f7a3a', '#c9b47a', '#f2f4f7'] },
    info: {
      diameter: '12.742 km',
      suhu: '15°C rata rata',
      bulan: 1,
      fakta: 'Satu satunya planet yang diketahui punya kehidupan.'
    },
    // radius relatif ke Bumi (sama kayak planet, nanti lewat scaleRadius)
    // orbitRadius dalam kelipatan radius planet induk yang SUDAH di-scale, bukan jarak asli.
    // Jarak asli Bulan 60x radius Bumi, kalau dipakai mentah Bulan bakal nyasar jauh dari Bumi di skala ini
    moons: [
      {
        id: 'moon',
        name: 'Bulan',
        radius: 0.27,
        orbitRadius: 2.4,
        orbitPeriod: 27.3,
        // Rotasinya sama dengan periode orbit (tidal lock)
        rotationPeriod: 27.3,
        tilt: 6.7,
        subtitle: 'Satelit alami Bumi',
        texture: '2k_moon.jpg',
        look: { type: 'rocky', colors: ['#4a4a4a', '#8a8a88', '#c4c4c0'] },
        info: {
          diameter: '3.474 km',
          jarak: '384.400 km dari Bumi',
          suhu: '-173°C sampai 127°C',
          fakta: 'Bulan selalu nunjukin sisi yang sama ke Bumi karena rotasinya sama persis dengan periode orbitnya.'
        }
      }
    ]
  },
  {
    id: 'mars',
    name: 'Mars',
    radius: 0.532,
    distance: 1.524,
    orbitPeriod: 687,
    rotationPeriod: 1.03,
    tilt: 25.2,
    texture: '2k_mars.jpg',
    look: { type: 'rocky', colors: ['#5c2410', '#a8461f', '#d97a48'] },
    info: {
      diameter: '6.779 km',
      suhu: '-65°C rata rata',
      bulan: 2,
      fakta: 'Punya gunung tertinggi di tata surya, Olympus Mons, tingginya hampir 3 kali Everest.'
    }
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    radius: 11.21,
    distance: 5.203,
    orbitPeriod: 4331,
    rotationPeriod: 0.41,
    tilt: 3.1,
    texture: '2k_jupiter.jpg',
    look: { type: 'gas', colors: ['#6e4a2e', '#c99a6b', '#efdcc0', '#a8603a', '#e8cfa8'] },
    info: {
      diameter: '139.820 km',
      suhu: '-110°C di atas awan',
      bulan: 95,
      fakta: 'Badai Bintik Merah Raksasa di Jupiter lebih gede dari Bumi dan udah ada ratusan tahun.'
    }
  },
  {
    id: 'saturn',
    name: 'Saturnus',
    radius: 9.45,
    distance: 9.537,
    orbitPeriod: 10747,
    rotationPeriod: 0.45,
    tilt: 26.7,
    texture: '2k_saturn.jpg',
    // inner dan outer dalam kelipatan radius planet, dipakai scene/saturnRing.js
    ring: { texture: '2k_saturn_ring_alpha.png', inner: 1.24, outer: 2.27 },
    look: { type: 'gas', colors: ['#8a7048', '#d9c08a', '#f2e3bd', '#b89a64', '#e6d3a3'] },
    info: {
      diameter: '116.460 km',
      suhu: '-140°C di atas awan',
      bulan: 146,
      fakta: 'Massa jenisnya lebih kecil dari air, jadi secara teori Saturnus bisa ngambang.'
    }
  },
  {
    id: 'uranus',
    name: 'Uranus',
    radius: 4.01,
    distance: 19.19,
    orbitPeriod: 30589,
    rotationPeriod: -0.72,
    tilt: 97.8,
    texture: '2k_uranus.jpg',
    look: { type: 'ice', colors: ['#7fc4cc', '#a6dde3', '#c8eef0'] },
    info: {
      diameter: '50.724 km',
      suhu: '-195°C',
      bulan: 28,
      fakta: 'Muternya miring hampir 98 derajat, jadi kayak bola yang menggelinding di orbitnya.'
    }
  },
  {
    id: 'neptune',
    name: 'Neptunus',
    radius: 3.88,
    distance: 30.07,
    orbitPeriod: 59800,
    rotationPeriod: 0.67,
    tilt: 28.3,
    texture: '2k_neptune.jpg',
    look: { type: 'ice', colors: ['#1d3a8a', '#3a62c9', '#6a8fe6'] },
    info: {
      diameter: '49.244 km',
      suhu: '-200°C',
      bulan: 16,
      fakta: 'Anginnya paling kencang di tata surya, bisa tembus 2.000 km per jam.'
    }
  }
];

export const sun = {
  id: 'sun',
  name: 'Matahari',
  subtitle: 'Bintang di pusat tata surya',
  // Rotasi di ekuator, kutubnya lebih lambat (sekitar 35 hari) karena Matahari bukan benda padat
  rotationPeriod: 25.4,
  tilt: 7.25,
  // opsional, cuma dicampur ke warna shader plasma
  texture: '2k_sun.jpg',
  info: {
    diameter: '1,39 juta km',
    suhu: '5.500°C di permukaan',
    fakta: 'Matahari nyimpen 99,8 persen dari seluruh massa tata surya.'
  }
};

// Sabuk asteroid utama di antara Mars dan Jupiter
// orbitPeriod kira kira periode orbit di 2,7 AU (hukum Kepler), dipakai buat muterin belt sebagai satu grup
export const asteroidBelt = {
  innerAU: 2.2,
  outerAU: 3.2,
  orbitPeriod: 1620,
  count: { desktop: 2000, mobile: 600 }
};
