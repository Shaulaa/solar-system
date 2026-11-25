// Isi data benda langit versi Inggris, digabung ke data asli lewat localize() (i18n/index.js).
// Kuncinya id benda. Cuma field teks yang ditulis, angka dan elemen orbit tetap dari data asli

export const bodies = {
  sun: {
    name: 'Sun',
    subtitle: 'The star at the center of the solar system',
    narration: 'Every journey starts here. The Sun holds almost all of the mass in the solar system and lights every planet.',
    info: { diameter: '1.39 million km', suhu: '5,500°C at the surface', fakta: 'The Sun holds 99.8 percent of all the mass in the solar system.' }
  },
  mercury: {
    name: 'Mercury',
    narration: 'Mercury races around the Sun. Its year lasts just 88 days.',
    info: { diameter: '4,879 km', suhu: '-173°C to 427°C', fakta: 'The smallest planet and the closest to the Sun, but not the hottest.' }
  },
  venus: {
    narration: 'Venus is wrapped in thick clouds that trap heat, making its surface the hottest in the solar system.',
    info: { diameter: '12,104 km', suhu: '464°C on average', fakta: 'A day on Venus is longer than its year.' }
  },
  earth: {
    name: 'Earth',
    narration: 'Home. The only place known so far to have life.',
    info: { diameter: '12,742 km', suhu: '15°C on average', fakta: 'The only planet known to have life.' }
  },
  moon: {
    name: 'Moon',
    subtitle: "Earth's natural satellite",
    info: {
      diameter: '3,474 km',
      jarak: '384,400 km from Earth',
      suhu: '-173°C to 127°C',
      fakta: 'The Moon always shows Earth the same side, because it turns exactly once per orbit.'
    }
  },
  mars: {
    narration: 'The red planet, with the tallest volcano and the deepest canyon in the solar system.',
    info: { diameter: '6,779 km', suhu: '-65°C on average', fakta: 'Home to the tallest mountain in the solar system, Olympus Mons, almost 3 times the height of Everest.' }
  },
  phobos: {
    name: 'Phobos',
    subtitle: 'The larger moon of Mars',
    info: {
      diameter: '22.5 km',
      jarak: '9,376 km from Mars',
      suhu: '-112°C to -4°C',
      fakta: 'Phobos is slowly spiraling in toward Mars. In tens of millions of years it will break apart and become a ring.'
    }
  },
  deimos: {
    subtitle: 'The small moon of Mars',
    info: {
      diameter: '12.4 km',
      jarak: '23,463 km from Mars',
      suhu: '-40°C on average',
      fakta: 'Its gravity is so weak that a small jump could send you drifting off into space.'
    }
  },
  jupiter: {
    narration: 'The largest gas giant. Its Great Red Spot has been swirling for hundreds of years.',
    info: { diameter: '139,820 km', suhu: '-110°C at the cloud tops', fakta: "Jupiter's Great Red Spot is a storm bigger than Earth that has lasted for centuries." }
  },
  io: {
    subtitle: 'Galilean moon of Jupiter',
    info: {
      diameter: '3,643 km',
      jarak: '421,700 km from Jupiter',
      suhu: '-143°C on average',
      fakta: 'The most volcanically active body in the solar system, with more than 400 active volcanoes.'
    }
  },
  europa: {
    subtitle: 'Galilean moon of Jupiter',
    info: {
      diameter: '3,122 km',
      jarak: '671,034 km from Jupiter',
      suhu: '-160°C on average',
      fakta: "Beneath its icy crust there is thought to be a salty ocean holding more water than all of Earth's oceans."
    }
  },
  ganymede: {
    name: 'Ganymede',
    subtitle: 'Galilean moon of Jupiter',
    info: {
      diameter: '5,268 km',
      jarak: '1,070,412 km from Jupiter',
      suhu: '-163°C on average',
      fakta: 'The largest moon in the solar system, bigger even than the planet Mercury.'
    }
  },
  callisto: {
    name: 'Callisto',
    subtitle: 'Galilean moon of Jupiter',
    info: {
      diameter: '4,821 km',
      jarak: '1,882,709 km from Jupiter',
      suhu: '-139°C on average',
      fakta: 'The most heavily cratered surface in the solar system, almost unchanged for billions of years.'
    }
  },
  saturn: {
    name: 'Saturn',
    narration: 'Its rings are made of billions of chunks of ice and rock, all orbiting the planet.',
    info: { diameter: '116,460 km', suhu: '-140°C at the cloud tops', fakta: 'It is less dense than water, so in theory Saturn would float.' }
  },
  enceladus: {
    subtitle: 'Icy moon of Saturn',
    info: {
      diameter: '504 km',
      jarak: '238,042 km from Saturn',
      suhu: '-198°C on average',
      fakta: "Jets of water from its south pole spray into space and help feed one of Saturn's rings."
    }
  },
  rhea: {
    subtitle: "Saturn's second largest moon",
    info: {
      diameter: '1,527 km',
      jarak: '527,068 km from Saturn',
      suhu: '-220°C to -174°C',
      fakta: 'About three quarters water ice and one quarter rock, with a surface covered in old craters.'
    }
  },
  titan: {
    subtitle: "Saturn's largest moon",
    info: {
      diameter: '5,150 km',
      jarak: '1,221,870 km from Saturn',
      suhu: '-179°C',
      fakta: 'The only moon with a thick atmosphere. Its surface has lakes and rivers of liquid methane.'
    }
  },
  uranus: {
    narration: 'Uranus rolls along its orbit, because its axis is tipped over by almost 98 degrees.',
    info: { diameter: '50,724 km', suhu: '-195°C', fakta: 'It spins tipped over by almost 98 degrees, like a ball rolling around its orbit.' }
  },
  miranda: {
    subtitle: 'Moon of Uranus',
    info: {
      diameter: '472 km',
      jarak: '129,390 km from Uranus',
      suhu: '-214°C to -187°C',
      fakta: 'Home to Verona Rupes, an ice cliff about 20 km high, one of the tallest cliffs in the solar system.'
    }
  },
  titania: {
    subtitle: 'The largest moon of Uranus',
    info: {
      diameter: '1,577 km',
      jarak: '435,910 km from Uranus',
      suhu: '-203°C to -184°C',
      fakta: "The largest moon of Uranus, named after the fairy queen in Shakespeare's A Midsummer Night's Dream."
    }
  },
  oberon: {
    subtitle: 'The outermost of the five large moons of Uranus',
    info: {
      diameter: '1,523 km',
      jarak: '583,520 km from Uranus',
      suhu: '-198°C on average',
      fakta: 'Covered in craters. A Voyager 2 photo caught a mountain about 11 km high on its edge.'
    }
  },
  neptune: {
    name: 'Neptune',
    narration: 'The farthest planet, where the fastest winds in the solar system blow.',
    info: { diameter: '49,244 km', suhu: '-200°C', fakta: 'The fastest winds in the solar system, reaching 2,000 km per hour.' }
  },
  triton: {
    subtitle: "Neptune's largest moon",
    info: {
      diameter: '2,707 km',
      jarak: '354,759 km from Neptune',
      suhu: '-235°C',
      fakta: "It orbits against Neptune's spin, a sign that Triton was once a Kuiper Belt object captured by Neptune's gravity."
    }
  },
  pluto: {
    subtitle: 'Dwarf planet in the Kuiper Belt',
    info: {
      diameter: '2,377 km',
      suhu: '-229°C on average',
      fakta: 'Reclassified as a dwarf planet in 2006, but Pluto still has 5 moons and ice mountains 3,500 meters high.'
    }
  },
  ceres: {
    subtitle: 'Dwarf planet in the asteroid belt',
    info: {
      diameter: '939 km',
      suhu: 'About -105°C',
      fakta: 'The largest object in the asteroid belt, about a third of its total mass. The Dawn spacecraft found bright salt deposits in Occator crater.'
    }
  },
  haumea: {
    subtitle: 'Dwarf planet in the Kuiper Belt',
    info: {
      diameter: '2,322 x 1,704 x 1,026 km',
      suhu: '-241°C',
      fakta: 'Stretched into a rugby ball shape by its fast spin, one turn every 3.9 hours. It has a ring and two moons.'
    }
  },
  makemake: {
    subtitle: 'Dwarf planet in the Kuiper Belt',
    info: {
      diameter: '1,430 km',
      suhu: '-239°C',
      fakta: 'Named after the creator god of the Rapa Nui people of Easter Island, because it was found shortly after Easter 2005.'
    }
  },
  eris: {
    subtitle: 'Dwarf planet in the scattered disc',
    info: {
      diameter: '2,326 km',
      suhu: '-243°C to -217°C',
      fakta: 'Found in 2005 and almost as large as Pluto. Its discovery is what led to Pluto being reclassified as a dwarf planet in 2006.'
    }
  },
  halley: {
    name: "Halley's Comet",
    subtitle: 'The most famous periodic comet',
    info: {
      diameter: 'Nucleus 15 x 8 km',
      fakta: 'The only short period comet visible to the naked eye that returns within a human lifetime. It next passes close to the Sun around July 2061.'
    }
  },
  encke: {
    name: 'Comet Encke',
    subtitle: 'The comet with the shortest known period',
    info: {
      diameter: 'Nucleus about 4.8 km',
      fakta: 'It circles the Sun every 3.3 years, faster than any other known comet. Its debris produces the Taurid meteor shower every October and November.'
    }
  },
  apophis: {
    subtitle: 'Near-Earth asteroid',
    info: {
      diameter: 'About 450 x 170 m',
      fakta: 'On 13 April 2029 it passes about 32,000 km above the Earth, closer than geostationary satellites, and will be visible to the naked eye. It will not hit the Earth for at least the next 100 years.'
    }
  }
};

// Bintang tetangga: nama yang beda dalam bahasa Inggris dan fakta khusus
export const stars = {
  'alpha-centauri': {
    fakta: 'The nearest star system visible to the naked eye: two Sun-like stars that orbit each other every 80 years.'
  },
  'proxima-centauri': {
    fakta: 'The closest star to the Sun. It has an Earth-sized planet, Proxima b, in its habitable zone.'
  },
  barnard: {
    name: "Barnard's Star",
    fakta: 'The star with the fastest motion across our sky, shifting by half the width of the full Moon about every 180 years.'
  },
  sirius: { fakta: 'The brightest star in the night sky. Its companion, Sirius B, is a white dwarf about the size of Earth.' },
  'luyten-726-8': {
    fakta: 'Two red dwarfs orbiting each other. One of them, UV Ceti, is the classic flare star that can suddenly brighten.'
  },
  'epsilon-eridani': { fakta: 'A young star surrounded by a dust belt, a glimpse of what the solar system may have looked like when it was young.' },
  procyon: { fakta: 'One of the brightest stars in the sky. Like Sirius, it has a white dwarf companion.' },
  '61-cygni': { fakta: 'The first star to have its distance measured, by Friedrich Bessel in 1838.' },
  'epsilon-indi': { fakta: 'It has two brown dwarf companions, objects too small to be stars but too big to be planets.' },
  'tau-ceti': { fakta: 'The nearest single Sun-like star, often a target in the search for signals from intelligent life.' },
  'luyten-star': { name: "Luyten's Star" },
  teegarden: { name: "Teegarden's Star", fakta: 'Only discovered in 2003 despite being so close, because it is extremely faint.' },
  kapteyn: {
    name: "Kapteyn's Star",
    fakta: 'One of the oldest stars near the Sun, thought to come from a dwarf galaxy the Milky Way swallowed long ago.'
  },
  altair: { fakta: 'It spins so fast, once every 9 hours or so, that it is flattened at the poles.' },
  vega: { fakta: 'Once the standard for zero magnitude. In about 12,000 years it will be the northern pole star.' },
  fomalhaut: { fakta: 'Surrounded by a wide ring of dust, photographed clearly by the Hubble and James Webb telescopes.' },
  pollux: { fakta: 'The nearest orange giant to the Sun, and it has a giant planet of its own.' },
  arcturus: { fakta: 'An orange giant and the brightest star in the northern half of the sky.' },
  capella: { fakta: 'Actually four stars: two yellow giants close together and a pair of red dwarfs farther out.' }
};

// Jenis bintang dari kelas spektral (data/nearbyStars.js)
export const starTypes = {
  O: 'Blue star',
  B: 'Blue star',
  A: 'White star',
  F: 'Yellow-white star',
  G: 'Yellow star',
  K: 'Orange dwarf',
  M: 'Red dwarf',
  giantK: 'Orange giant',
  giantOther: 'Yellow giant'
};

export const starText = {
  subtitle: (type, constellation) => `${type} in ${constellation}`,
  factM: (distance) =>
    `A red dwarf, the most common kind of star in the galaxy. Too faint to see without a telescope, even though it is only ${distance} light years away.`,
  factK: 'An orange dwarf, a little smaller and cooler than the Sun, but with a much longer life.',
  factOther: (distance) => `Its light takes ${distance} years to reach Earth.`
};

// Galaksi Grup Lokal (data/localGroup.js)
export const galaxies = {
  'milky-way': {
    name: 'Milky Way',
    subtitle: 'The galaxy the solar system lives in',
    galaxyType: 'Barred spiral',
    stars: '100 to 400 billion',
    fakta: 'With Andromeda, one of the two largest galaxies in the Local Group. The Sun sits in the Orion Arm, about 26,000 light years from the center.'
  },
  andromeda: {
    subtitle: 'The nearest large galaxy',
    galaxyType: 'Spiral',
    stars: 'About 1 trillion',
    fakta:
      'From a dark site it is visible without a telescope as a faint smudge. It is approaching at about 110 km per second, but recent calculations (2025) give only about a 50 percent chance of colliding with the Milky Way in the next 10 billion years.'
  },
  triangulum: {
    subtitle: 'The smallest spiral in the Local Group',
    galaxyType: 'Spiral',
    stars: 'About 40 billion',
    fakta: 'Visible to the naked eye under very dark skies. It hosts NGC 604, a giant star-forming cloud about 1,500 light years across.'
  },
  lmc: {
    name: 'Large Magellanic Cloud',
    subtitle: 'A satellite galaxy of the Milky Way',
    galaxyType: 'Magellanic spiral (barred irregular)',
    stars: 'About 30 billion',
    constellation: 'Dorado and Mensa',
    fakta:
      'Visible to the naked eye from the Southern Hemisphere and the tropics, low in the southern sky. It holds the Tarantula Nebula, the most active star-forming region in the Local Group.'
  },
  smc: {
    name: 'Small Magellanic Cloud',
    subtitle: 'A satellite galaxy of the Milky Way',
    galaxyType: 'Irregular dwarf galaxy',
    stars: 'A few hundred million',
    fakta:
      'Pulled out of shape by the gravity of the Large Magellanic Cloud and the Milky Way. The two Magellanic Clouds are linked by a bridge of gas called the Magellanic Bridge.'
  }
};

// Benda pencarian / tur di main.js
export const entries = {
  'milky-way': {
    name: 'Milky Way',
    subtitle: 'The galaxy the solar system lives in',
    narration:
      'From this far out the Sun is a single point in the Orion Arm, about 26,000 light years from the center of the Milky Way. Our galaxy holds 100 to 400 billion stars.'
  },
  'local-group': {
    name: 'Local Group',
    subtitle: 'The group of galaxies the Milky Way belongs to',
    narration:
      'The Milky Way is just one of more than 80 galaxies in the Local Group. Our nearest large neighbor, Andromeda, is 2.5 million light years away: the light reaching us tonight set out when the first early humans were appearing.'
  }
};

// Wilayah jalur gerhana Matahari total (data/eclipses.js), kuncinya tanggal
export const eclipseWhere = {
  '2026-08-12': 'Greenland, Iceland, Spain',
  '2027-08-02': 'Spain, North Africa, Middle East',
  '2028-07-22': 'Australia, New Zealand',
  '2030-11-25': 'Southern Africa, Australia'
};
