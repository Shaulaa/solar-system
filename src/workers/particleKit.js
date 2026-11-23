// Bahan bersama worker partikel (workers/galaxyWorker.js dan workers/localGroupWorker.js)
//
// Format buffer satu komponen sama dengan yang dibaca galaxy/galaxyParticles.js dan
// galaxy/localGroup.js: position (xyz), color (rgb linear, sudah dikali kecerahan), size (unit galaksi),
// dan seed (0 sampai 1, variasi halus di shader)

// Kelas spektral bintang: warna (linear RGB), pengali kecerahan, dan peluangnya di populasi muda
// (lengan) dan tua (piringan, halo). Bintang merah dan oranye paling banyak tapi redup, bintang biru
// sedikit tapi terang. Versi G3 cuma punya tiga warna, dari dekat kelihatan seragam kayak salju
export const STAR_TYPES = [
  { color: [0.55, 0.7, 1.0], boost: 1.7, young: 0.2, old: 0.0 }, // O B
  { color: [0.76, 0.85, 1.0], boost: 1.3, young: 0.22, old: 0.04 }, // A
  { color: [1.0, 0.97, 0.92], boost: 1.1, young: 0.2, old: 0.12 }, // F
  { color: [1.0, 0.9, 0.72], boost: 1.0, young: 0.16, old: 0.25 }, // G
  { color: [1.0, 0.76, 0.5], boost: 0.85, young: 0.12, old: 0.3 }, // K
  { color: [1.0, 0.6, 0.42], boost: 0.7, young: 0.1, old: 0.29 } // M
];

// RNG ber-seed (mulberry32): hasilnya sama persis tiap kali dibuka
export function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBuffers(name, count) {
  return {
    name,
    count,
    position: new Float32Array(count * 3),
    color: new Float32Array(count * 3),
    size: new Float32Array(count),
    seed: new Float32Array(count)
  };
}

// Fungsi acak yang dipakai semua pembuat partikel, berbagi satu RNG ber-seed.
// Urutan pemanggilan random() menentukan hasil, jadi tiap fungsi di sini jangan diubah urutan
// pemakaian random-nya (galaksi Bima Sakti harus tetap sama persis)
export function createParticleKit(seed) {
  const random = createRandom(seed);
  // Box Muller, cukup satu nilai per panggilan
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

  function write(buffers, i, x, y, z, base, brightness, size) {
    buffers.position[i * 3] = x;
    buffers.position[i * 3 + 1] = y;
    buffers.position[i * 3 + 2] = z;
    buffers.color[i * 3] = base[0] * brightness;
    buffers.color[i * 3 + 1] = base[1] * brightness;
    buffers.color[i * 3 + 2] = base[2] * brightness;
    buffers.size[i] = size;
    buffers.seed[i] = random();
  }

  // Ukuran partikel (unit galaksi): kebanyakan kecil, sedikit yang besar.
  // Dari jauh cahaya partikel sebanding luasnya (energi dijaga di shader), dari dekat partikel mentok
  // di ukuran maksimal layar dengan kecerahan puncak yang sama. Jadi ukuran dasar yang lebih besar
  // bikin galaksi dari jauh lebih terang tanpa bikin bintang dari dekat jadi lebih terang
  const sizeOf = (base) => base * (0.5 + 1.1 * random() * random());

  // Bintang acak dari populasi 'young' atau 'old'. Kecerahannya pangkat 4: mayoritas redup,
  // segelintir terang, dikali pengali kelas spektralnya
  function pickStar(population) {
    let pick = random();
    let type = STAR_TYPES[STAR_TYPES.length - 1];
    for (const t of STAR_TYPES) {
      pick -= t[population];
      if (pick <= 0) {
        type = t;
        break;
      }
    }
    const u = random();
    return { color: type.color, brightness: (0.15 + 2.2 * u * u * u * u) * type.boost };
  }

  // r dengan kepadatan menurun eksponensial ke luar, dipotong di [rStart, rEnd]
  function sampleRadius(rStart, rEnd, scale) {
    const span = 1 - Math.exp(-(rEnd - rStart) / scale);
    return rStart - scale * Math.log(1 - random() * span);
  }

  return { random, gaussian, write, sizeOf, pickStar, sampleRadius };
}
