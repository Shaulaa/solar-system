// Web Worker pembuat partikel galaksi Grup Lokal (Andromeda, Triangulum, Awan Magellan)
//
// Sama seperti workers/galaxyWorker.js: dihitung di thread terpisah, hasilnya Float32Array
// transferable. Satu komponen per galaksi, di koordinat lokal galaksinya sendiri: pusat di (0,0,0),
// piringan di bidang XZ, sumbu panjang di +X (galaxy/localGroup.js yang memutar dan menaruhnya).
//
// Galaksi ini cuma dilihat dari jauh (ribuan sampai puluhan ribu unit), jadi bentuknya disederhanakan:
//   spiral      bulge, lengan spiral logaritmik, piringan yang memadat di sekitar lengan, halo tipis
//   irregular   batang yang bergeser dari pusat, gumpalan bintang muda, nebula, piringan bergelombang
//   dwarfs      semua galaksi kerdil dalam satu komponen, masing masing bola bintang tua yang redup.
//               Posisinya sudah di koordinat grup `galaxy`, bukan koordinat lokal
//
// Kecerahan total tiap galaksi diatur lewat ukuran partikel. Dari jauh cahaya satu partikel
// sebanding ukuran kuadratnya (energi dijaga di shader, lihat galaxy/galaxyShaders.js), jadi semua
// ukuran dikali satu faktor supaya jumlah (kecerahan x ukuran^2) = luminosity x referenceFlux.
// referenceFlux = angka yang sama untuk Bima Sakti, jadi perbandingan kecerahannya benar
// berapa pun jumlah partikelnya
//
// Pesan masuk   { galaxies: [{ id, shape }], dwarfs: [{ position, radius }], scale, seed, referenceFlux }
// Pesan keluar  { components: [{ name, count, position, color, size, seed }], ms }

import { createParticleKit, createBuffers } from './particleKit.js';

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

// Warna dalam linear RGB, sama dengan galaxyWorker.js
const COLORS = {
  bulge: [1.0, 0.78, 0.5],
  hii: [1.0, 0.32, 0.5],
  cluster: [0.55, 0.75, 1.0]
};

// Jumlah partikel minimal per galaksi, biar galaksi kecil di HP gak jadi beberapa titik doang
const MIN_COUNT = 1500;
// Galaksi kerdil: partikel per unit jari jari (dibatasi), dan kecerahannya. Kecerahan asli galaksi
// kerdil cuma sepersepuluh ribu sampai seperseribu Bima Sakti, terlalu redup buat kelihatan. Di sini
// kecerahan permukaannya sama dengan Awan Magellan Besar, dan minimal DWARF_MIN_LUMINOSITY
// biar yang kecil tetap jadi bercak samar
const DWARF_PARTICLES = { perRadius: 10, min: 80, max: 500 };
const DWARF_SURFACE = 8e-6;
const DWARF_MIN_LUMINOSITY = 0.004;

function makeSpiral(kit, b, shape) {
  const { random, gaussian, write, sizeOf, pickStar, sampleRadius } = kit;
  const { count, radius, scale, thickness, bulge, arms } = shape;
  const k = Math.tan(arms.pitch * DEG);
  const armGap = TWO_PI / arms.count;
  let i = 0;

  // Sudut lengan pertama di jarak r. Lengan lain berjarak armGap
  const armTheta = (r) => Math.log(r / arms.rStart) / k;

  // Jarak tegak lurus titik (r, theta) ke lengan terdekat
  function distanceToArm(r, theta) {
    let delta = (theta - armTheta(Math.max(r, arms.rStart))) % armGap;
    if (delta < 0) delta += armGap;
    if (delta > armGap / 2) delta -= armGap;
    return Math.abs(delta) * r * Math.sin(arms.pitch * DEG);
  }
  const armSpread = (r) => (3 + r * 0.045) * arms.width;

  // Bulge: elipsoid gaussian dengan inti yang lebih rapat
  for (const end = Math.round(count * bulge.share); i < end; i++) {
    const spread = random() < 0.2 ? bulge.spread * 0.35 : bulge.spread;
    write(b, i, gaussian() * spread, gaussian() * spread * 0.6, gaussian() * spread, COLORS.bulge, 0.7 + random() * 0.5, sizeOf(1));
  }

  // Halo: bintang tua jarang berbentuk bola, kepadatan turun kira kira 1/r^3
  for (const end = i + Math.round(count * (shape.halo ?? 0)); i < end; i++) {
    const r = bulge.spread * Math.exp(random() * Math.log(radius / bulge.spread));
    const cosPhi = 2 * random() - 1;
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
    const theta = random() * TWO_PI;
    const star = pickStar('old');
    write(b, i, r * sinPhi * Math.cos(theta), r * cosPhi, r * sinPhi * Math.sin(theta), star.color, star.brightness * 0.7, sizeOf(1));
  }

  // Lengan: bintang muda di sepanjang spiral logaritmik, seperlimanya ngumpul di gugus
  const clumps = Array.from({ length: Math.max(12, Math.round((count * arms.share) / 300)) }, () => {
    const r = sampleRadius(arms.rStart, radius, scale * 1.6);
    const theta = armTheta(r) + Math.floor(random() * arms.count) * armGap;
    return { x: r * Math.cos(theta), z: r * Math.sin(theta), radius: 2 + random() * armSpread(r) * 0.4 };
  });
  for (const end = i + Math.round(count * arms.share); i < end; i++) {
    let x;
    let z;
    if (random() < 0.2) {
      const clump = clumps[Math.floor(random() * clumps.length)];
      x = clump.x + gaussian() * clump.radius;
      z = clump.z + gaussian() * clump.radius;
    } else {
      const r = sampleRadius(arms.rStart, radius, scale * 1.6);
      const theta = armTheta(r) + Math.floor(random() * arms.count) * armGap;
      const spread = armSpread(r);
      x = r * Math.cos(theta) + gaussian() * spread;
      z = r * Math.sin(theta) + gaussian() * spread;
    }
    const star = pickStar('young');
    write(b, i, x, gaussian() * thickness * 0.4, z, star.color, star.brightness, sizeOf(1));
  }

  // Piringan: bintang tua, lebih sering diterima di dekat lengan biar celah antar lengan lebih gelap
  for (; i < count; i++) {
    let r = 0;
    let theta = 0;
    for (let tries = 0; tries < 12; tries++) {
      r = sampleRadius(bulge.spread * 0.4, radius, scale);
      theta = random() * TWO_PI;
      const d = r < arms.rStart ? 0 : distanceToArm(r, theta) / (armSpread(r) * 1.8);
      if (random() < 0.3 + 0.7 * Math.exp(-d * d)) break;
    }
    const star = pickStar('old');
    const y = gaussian() * thickness * (1 + r / radius);
    write(b, i, r * Math.cos(theta), y, r * Math.sin(theta), star.color, star.brightness * 0.6, sizeOf(1));
  }
}

function makeIrregular(kit, b, shape) {
  const { random, gaussian, write, sizeOf, pickStar, sampleRadius } = kit;
  const { count, radius, scale, thickness, bar, clumps, nebula } = shape;
  const stretch = shape.stretch ?? 1;
  let i = 0;
  // Tiap titik dipanjangkan di sumbu X (sumbu panjang galaksi)
  const put = (x, y, z, color, brightness, size) => write(b, i, x * stretch, y, z, color, brightness, size);

  // Batang bintang tua yang pusatnya bergeser dari pusat piringan (ciri khas Awan Magellan Besar)
  for (const end = Math.round(count * bar.share); i < end; i++) {
    const along = Math.max(-bar.halfLength, Math.min(bar.halfLength, gaussian() * bar.halfLength * 0.5));
    const star = pickStar(random() < 0.6 ? 'old' : 'young');
    put(bar.offset[0] + along, gaussian() * thickness * 0.5, bar.offset[1] + gaussian() * bar.width, star.color, star.brightness, sizeOf(1));
  }

  // Gumpalan bintang muda tersebar acak
  const centers = Array.from({ length: clumps.count }, () => {
    const r = sampleRadius(0, radius * 0.85, scale);
    const theta = random() * TWO_PI;
    return { x: r * Math.cos(theta), z: r * Math.sin(theta), radius: 2 + random() * radius * 0.08 };
  });
  for (const end = i + Math.round(count * clumps.share); i < end; i++) {
    const clump = centers[Math.floor(random() * centers.length)];
    const star = pickStar('young');
    put(clump.x + gaussian() * clump.radius, gaussian() * thickness * 0.4, clump.z + gaussian() * clump.radius, star.color, star.brightness, sizeOf(1));
  }

  // Nebula terang (misal Nebula Tarantula di Awan Magellan Besar)
  for (const end = i + Math.round(count * nebula.share); i < end; i++) {
    const hii = random() < 0.7;
    put(nebula.at[0] + gaussian() * 3, gaussian() * 1.5, nebula.at[1] + gaussian() * 3, hii ? COLORS.hii : COLORS.cluster, 1.6 + random() * 1.6, sizeOf(0.7));
  }

  // Piringan bergelombang: kepadatannya naik turun mengikuti sudut, biar gak bulat rata
  const phase = random() * TWO_PI;
  for (; i < count; i++) {
    let r = 0;
    let theta = 0;
    for (let tries = 0; tries < 12; tries++) {
      r = sampleRadius(0, radius, scale);
      theta = random() * TWO_PI;
      const wave = 0.5 + 0.5 * Math.sin(2 * theta + phase + r * 0.04);
      if (random() < 0.35 + 0.65 * wave) break;
    }
    const star = pickStar(random() < 0.5 ? 'old' : 'young');
    put(r * Math.cos(theta), gaussian() * thickness, r * Math.sin(theta), star.color, star.brightness * 0.7, sizeOf(1));
  }
}

// Kalikan ukuran partikel from sampai to supaya jumlah (kecerahan x ukuran^2) = target
function normalizeFlux(b, target, from = 0, to = b.count) {
  let flux = 0;
  for (let i = from; i < to; i++) {
    const brightness = (b.color[i * 3] + b.color[i * 3 + 1] + b.color[i * 3 + 2]) / 3;
    flux += brightness * b.size[i] * b.size[i];
  }
  const factor = Math.sqrt(target / flux);
  for (let i = from; i < to; i++) b.size[i] *= factor;
}

// Galaksi kerdil: bola gaussian bintang tua, sedikit pepat, di posisinya masing masing
function makeDwarfs(kit, dwarfs, scale, referenceFlux) {
  const { gaussian, write, sizeOf, pickStar } = kit;
  const { perRadius, min, max } = DWARF_PARTICLES;
  const counts = dwarfs.map((d) => Math.max(min, Math.round(Math.min(d.radius * perRadius, max) * scale)));
  const b = createBuffers('dwarfs', counts.reduce((sum, n) => sum + n, 0));
  let i = 0;
  dwarfs.forEach((dwarf, index) => {
    const from = i;
    const sigma = dwarf.radius * 0.45;
    const [x, y, z] = dwarf.position;
    for (const end = i + counts[index]; i < end; i++) {
      const star = pickStar('old');
      write(b, i, x + gaussian() * sigma, y + gaussian() * sigma * 0.7, z + gaussian() * sigma, star.color, star.brightness, sizeOf(1));
    }
    const luminosity = Math.max(DWARF_SURFACE * dwarf.radius * dwarf.radius, DWARF_MIN_LUMINOSITY);
    normalizeFlux(b, luminosity * referenceFlux, from, i);
  });
  return b;
}

export function generateLocalGroup({ galaxies, dwarfs = [], scale = 1, seed = 1, referenceFlux }) {
  const kit = createParticleKit(seed);
  const components = galaxies.map(({ id, shape }) => {
    const count = Math.max(MIN_COUNT, Math.round(shape.count * scale));
    const buffers = createBuffers(id, count);
    const sized = { ...shape, count };
    if (shape.type === 'spiral') makeSpiral(kit, buffers, sized);
    else makeIrregular(kit, buffers, sized);
    normalizeFlux(buffers, shape.luminosity * referenceFlux);
    return buffers;
  });
  if (dwarfs.length > 0) components.push(makeDwarfs(kit, dwarfs, scale, referenceFlux));
  return components;
}

self.onmessage = (event) => {
  const start = performance.now();
  const components = generateLocalGroup(event.data);
  const ms = performance.now() - start;
  const transfer = components.flatMap((c) => [c.position.buffer, c.color.buffer, c.size.buffer, c.seed.buffer]);
  self.postMessage({ components, ms }, transfer);
};
