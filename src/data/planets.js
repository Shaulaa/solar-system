// Data planet tata surya
// radius relatif ke Bumi, distance dalam AU, periode dalam hari (Bumi), tilt dalam derajat
// rotationPeriod negatif artinya rotasinya kebalik (retrograde)
//
// distance = sumbu semi mayor (jarak rata rata), orbitPeriod = periode sidereal.
// orbit = elemen orbit J2000 dari JPL (Standish, "Keplerian Elements for Approximate Positions
// of the Major Planets"), semua dalam derajat. Dipakai utils/kepler.js buat ngitung posisi asli
// planet di tanggal simulasi. perihelion dan meanLongitude berupa bujur, bukan argumen
//
// Panel info (ui/infoPanel.js) baca semua isinya dari sini.
// Angka seperti distance, orbitPeriod, rotationPeriod, dan tilt diformat otomatis
// (AU ke juta km, hari ke tahun / jam), jadi gak perlu ditulis ulang sebagai teks.
// subtitle cuma diisi kalau gak bisa diturunkan (planet otomatis "Planet ke N dari Matahari")
// narration teks pendek yang muncul di bawah layar waktu tur otomatis (controls/tour.js)
// aliases nama lain buat pencarian (misal ejaan Inggris), id juga otomatis ikut dicari

export const planets = [
  {
    id: 'mercury',
    name: 'Merkurius',
    radius: 0.383,
    distance: 0.387,
    orbitPeriod: 87.969,
    orbit: { eccentricity: 0.2056, inclination: 7.00, node: 48.33, perihelion: 77.46, meanLongitude: 252.25 },
    rotationPeriod: 58.6,
    tilt: 0.03,
    texture: '2k_mercury.jpg',
    narration: 'Merkurius ngebut mengelilingi Matahari, satu tahunnya cuma 88 hari.',
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
    orbitPeriod: 224.701,
    orbit: { eccentricity: 0.0068, inclination: 3.39, node: 76.68, perihelion: 131.60, meanLongitude: 181.98 },
    rotationPeriod: -243,
    tilt: 177.4,
    texture: '2k_venus_atmosphere.jpg',
    narration: 'Venus diselimuti awan tebal yang memerangkap panas, permukaannya jadi yang terpanas di tata surya.',
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
    orbitPeriod: 365.256,
    orbit: { eccentricity: 0.0167, inclination: 0.00, node: 0.00, perihelion: 102.94, meanLongitude: 100.46 },
    rotationPeriod: 1,
    tilt: 23.4,
    // Bumi punya 5 tekstur, dipakai sama scene/earth.js (permukaan siang malam, awan,
    // relief, dan kilau laut). Normal dan specular map aslinya .tif, dikonversi ke .png
    texture: {
      day: '2k_earth_daymap.jpg',
      night: '2k_earth_nightmap.jpg',
      clouds: '2k_earth_clouds.jpg',
      normal: '2k_earth_normal_map.png',
      specular: '2k_earth_specular_map.png'
    },
    narration: 'Rumah kita. Satu satunya tempat yang sejauh ini diketahui punya kehidupan.',
    look: { type: 'earth', colors: ['#0b2a5c', '#1d5fa8', '#3f7a3a', '#c9b47a', '#f2f4f7'] },
    info: {
      diameter: '12.742 km',
      suhu: '15°C rata rata',
      bulan: 1,
      fakta: 'Satu satunya planet yang diketahui punya kehidupan.'
    },
    // radius relatif ke Bumi (sama kayak planet, nanti lewat scaleRadius)
    // orbitRadius dalam kelipatan radius planet induk yang SUDAH di-scale (mode Enak Dilihat).
    // Jarak asli Bulan 60x radius Bumi, kalau dipakai mentah Bulan bakal nyasar jauh dari Bumi di skala ini.
    // distanceKm jarak asli, dipakai mode Skala Nyata
    moons: [
      {
        id: 'moon',
        name: 'Bulan',
        radius: 0.27,
        orbitRadius: 2.3,
        distanceKm: 384400,
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
    orbitPeriod: 686.98,
    orbit: { eccentricity: 0.0934, inclination: 1.85, node: 49.56, perihelion: -23.94, meanLongitude: -4.55 },
    rotationPeriod: 1.03,
    tilt: 25.2,
    texture: '2k_mars.jpg',
    narration: 'Planet merah dengan gunung tertinggi dan ngarai terdalam di tata surya.',
    look: { type: 'rocky', colors: ['#5c2410', '#a8461f', '#d97a48'] },
    info: {
      diameter: '6.779 km',
      suhu: '-65°C rata rata',
      bulan: 2,
      fakta: 'Punya gunung tertinggi di tata surya, Olympus Mons, tingginya hampir 3 kali Everest.'
    },
    // Bulan yang orbitnya cuma beberapa jam (Fobos 7,6 jam) diperlambat secara visual di moons.js,
    // kalau nggak di kecepatan tinggi bakal kelihatan kedip kedip. Angka di sini tetap angka asli
    moons: [
      {
        id: 'phobos',
        name: 'Fobos',
        aliases: ['phobos'],
        subtitle: 'Bulan terbesar Mars',
        radius: 0.00177,
        orbitRadius: 1.8,
        distanceKm: 9376,
        orbitPeriod: 0.319,
        rotationPeriod: 0.319,
        look: { type: 'rocky', colors: ['#3d3530', '#6b5e54', '#9a8a7c'] },
        info: {
          diameter: '22,5 km',
          jarak: '9.376 km dari Mars',
          suhu: '-112°C sampai -4°C',
          fakta: 'Fobos makin lama makin dekat ke Mars. Puluhan juta tahun lagi bakal hancur dan jadi cincin.'
        }
      },
      {
        id: 'deimos',
        name: 'Deimos',
        subtitle: 'Bulan kecil Mars',
        radius: 0.000973,
        orbitRadius: 2.6,
        distanceKm: 23463,
        orbitPeriod: 1.263,
        rotationPeriod: 1.263,
        look: { type: 'rocky', colors: ['#4a4038', '#7d7064', '#b0a394'] },
        info: {
          diameter: '12,4 km',
          jarak: '23.463 km dari Mars',
          suhu: '-40°C rata rata',
          fakta: 'Gravitasinya lemah banget, lompatan kecil di sana bisa bikin kamu melayang ke luar angkasa.'
        }
      }
    ]
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    radius: 11.21,
    distance: 5.203,
    orbitPeriod: 4332.59,
    orbit: { eccentricity: 0.0484, inclination: 1.30, node: 100.47, perihelion: 14.73, meanLongitude: 34.40 },
    rotationPeriod: 0.41,
    tilt: 3.1,
    texture: '2k_jupiter.jpg',
    narration: 'Raksasa gas terbesar. Badai Bintik Merahnya sudah berputar ratusan tahun.',
    look: { type: 'gas', colors: ['#6e4a2e', '#c99a6b', '#efdcc0', '#a8603a', '#e8cfa8'] },
    info: {
      diameter: '139.820 km',
      suhu: '-110°C di atas awan',
      bulan: 95,
      fakta: 'Badai Bintik Merah Raksasa di Jupiter lebih gede dari Bumi dan udah ada ratusan tahun.'
    },
    // 4 bulan Galilean, ditemukan Galileo Galilei tahun 1610
    moons: [
      {
        id: 'io',
        name: 'Io',
        subtitle: 'Bulan Galilean Jupiter',
        radius: 0.286,
        orbitRadius: 1.6,
        distanceKm: 421700,
        orbitPeriod: 1.769,
        rotationPeriod: 1.769,
        look: { type: 'rocky', colors: ['#8a6a1f', '#d8b640', '#f3e9a2'] },
        info: {
          diameter: '3.643 km',
          jarak: '421.700 km dari Jupiter',
          suhu: '-143°C rata rata',
          fakta: 'Benda paling aktif secara vulkanik di tata surya, punya lebih dari 400 gunung berapi aktif.'
        }
      },
      {
        id: 'europa',
        name: 'Europa',
        subtitle: 'Bulan Galilean Jupiter',
        radius: 0.245,
        orbitRadius: 2.0,
        distanceKm: 671034,
        orbitPeriod: 3.551,
        rotationPeriod: 3.551,
        look: { type: 'rocky', colors: ['#8a7a66', '#cfc4b0', '#f1ebe0'] },
        info: {
          diameter: '3.122 km',
          jarak: '671.034 km dari Jupiter',
          suhu: '-160°C rata rata',
          fakta: 'Di bawah kerak esnya diduga ada lautan air asin, isinya lebih banyak dari semua lautan di Bumi.'
        }
      },
      {
        id: 'ganymede',
        name: 'Ganimede',
        aliases: ['ganymede'],
        subtitle: 'Bulan Galilean Jupiter',
        radius: 0.4134,
        orbitRadius: 2.5,
        distanceKm: 1070412,
        orbitPeriod: 7.155,
        rotationPeriod: 7.155,
        look: { type: 'rocky', colors: ['#4f4740', '#8b8073', '#c2b8aa'] },
        info: {
          diameter: '5.268 km',
          jarak: '1.070.412 km dari Jupiter',
          suhu: '-163°C rata rata',
          fakta: 'Bulan terbesar di tata surya, bahkan lebih besar dari planet Merkurius.'
        }
      },
      {
        id: 'callisto',
        name: 'Kalisto',
        aliases: ['callisto'],
        subtitle: 'Bulan Galilean Jupiter',
        radius: 0.3783,
        orbitRadius: 3.1,
        distanceKm: 1882709,
        orbitPeriod: 16.69,
        rotationPeriod: 16.69,
        look: { type: 'rocky', colors: ['#2e2a26', '#5c544b', '#8d8478'] },
        info: {
          diameter: '4.821 km',
          jarak: '1.882.709 km dari Jupiter',
          suhu: '-139°C rata rata',
          fakta: 'Permukaannya paling penuh kawah di tata surya dan hampir gak berubah selama miliaran tahun.'
        }
      }
    ]
  },
  {
    id: 'saturn',
    name: 'Saturnus',
    radius: 9.45,
    distance: 9.537,
    orbitPeriod: 10759.22,
    orbit: { eccentricity: 0.0539, inclination: 2.49, node: 113.66, perihelion: 92.60, meanLongitude: 49.95 },
    rotationPeriod: 0.45,
    tilt: 26.7,
    texture: '2k_saturn.jpg',
    // inner dan outer dalam kelipatan radius planet, dipakai scene/saturnRing.js
    ring: { texture: '2k_saturn_ring_alpha.png', inner: 1.24, outer: 2.27 },
    narration: 'Cincinnya tersusun dari miliaran bongkahan es dan batu yang ikut mengorbit planet.',
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
    orbitPeriod: 30685.4,
    orbit: { eccentricity: 0.0473, inclination: 0.77, node: 74.02, perihelion: 170.95, meanLongitude: 313.24 },
    rotationPeriod: -0.72,
    tilt: 97.8,
    texture: '2k_uranus.jpg',
    narration: 'Uranus menggelinding di orbitnya karena sumbunya miring hampir 98 derajat.',
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
    orbitPeriod: 60189,
    orbit: { eccentricity: 0.0086, inclination: 1.77, node: 131.78, perihelion: 44.96, meanLongitude: -55.12 },
    rotationPeriod: 0.67,
    tilt: 28.3,
    texture: '2k_neptune.jpg',
    narration: 'Planet terjauh, tempat angin paling kencang di tata surya bertiup.',
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
  narration:
    'Semua perjalanan dimulai dari sini. Matahari menyimpan hampir seluruh massa tata surya dan menerangi semua planet.',
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

// Planet katai. Pluto disembunyikan (hidden) dan baru muncul kalau user ngetik "pluto"
// di kotak pencarian
export const dwarfPlanets = [
  {
    id: 'pluto',
    name: 'Pluto',
    kind: 'dwarf',
    hidden: true,
    subtitle: 'Planet katai di Sabuk Kuiper',
    radius: 0.1868,
    distance: 39.48,
    orbitPeriod: 90560,
    orbit: { eccentricity: 0.2488, inclination: 17.14, node: 110.30, perihelion: 224.07, meanLongitude: 238.93 },
    rotationPeriod: -6.39,
    tilt: 122.5,
    look: { type: 'rocky', colors: ['#5e4c3e', '#b89d82', '#efe1cf'] },
    info: {
      diameter: '2.377 km',
      suhu: '-229°C rata rata',
      bulan: 5,
      fakta:
        'Sejak 2006 statusnya diturunkan jadi planet katai, tapi Pluto tetap punya 5 bulan dan gunung es setinggi 3.500 meter.'
    }
  }
];

// Sabuk asteroid utama di antara Mars dan Jupiter
// orbitPeriod kira kira periode orbit di 2,7 AU (hukum Kepler), dipakai buat muterin belt sebagai satu grup
export const asteroidBelt = {
  innerAU: 2.2,
  outerAU: 3.2,
  orbitPeriod: 1620,
  count: { desktop: 2000, mobile: 600 }
};
