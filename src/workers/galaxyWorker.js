// Web Worker pembuat partikel galaksi Bima Sakti (tahap G2: bulge, batang, lengan spiral, piringan)
//
// Dijalankan di thread terpisah biar halaman gak freeze waktu ratusan ribu partikel dihitung.
// Hasilnya dikirim balik sebagai Float32Array transferable (pindah kepemilikan, gak disalin).
//
// Koordinat galaksi (1 unit = 100 tahun cahaya): pusat galaksi di (0,0,0), piringan di bidang XZ,
// sumbu Y = kutub utara galaksi, Matahari di (-260, 0.65, 0). Sudut theta = atan2(z, x),
// jadi Matahari ada di theta = PI
//
// Pesan masuk   { total, seed }
// Pesan keluar  { components: [{ name, count, position, color, size, seed }], ms }

const DEG = Math.PI / 180;

// Lengan spiral logaritmik dengan sudut pitch 12 derajat: r = rRef * exp(k * (theta - PI))
const PITCH = 12 * DEG;
const K = Math.tan(PITCH);
// Panjang batang sekitar 27.000 tahun cahaya, jadi setengahnya 135 unit
const BAR_HALF_LENGTH = 135;
const DISK_RADIUS = 540;

// Tiap lengan didefinisikan dari jaraknya ke pusat di arah Matahari (theta = PI).
// Empat lengan berjarak seperempat putaran, jadi di satu arah jaraknya berurutan dikali
// exp(K * PI / 2) = 1,4. Lengan Scutum Centaurus dipilih 149 unit supaya di r = 135
// sudutnya 27 derajat dari garis Matahari ke pusat, dan dua lengan utama nyambung ke ujung batang.
// Matahari (260) jatuh di antara Sagitarius (208) dan Perseus (290), di taji Orion
const ARM_STEP = Math.exp((K * Math.PI) / 2);
const SCUTUM_REF = 149;
const ARMS = [
  { name: 'scutum-centaurus', rRef: SCUTUM_REF, rStart: BAR_HALF_LENGTH, rEnd: 520, weight: 0.33, width: 1 },
  { name: 'sagitarius', rRef: SCUTUM_REF * ARM_STEP, rStart: 120, rEnd: 430, weight: 0.13, width: 0.75 },
  { name: 'perseus', rRef: SCUTUM_REF * ARM_STEP ** 2, rStart: BAR_HALF_LENGTH, rEnd: 520, weight: 0.33, width: 1 },
  { name: 'norma', rRef: SCUTUM_REF * ARM_STEP ** 3, rStart: 120, rEnd: 430, weight: 0.13, width: 0.75 }
];
// Taji Orion (lengan lokal tempat Matahari): potongan pendek yang lewat persis di posisi Matahari
const ORION = { rRef: 260, thetaSpan: 0.65, weight: 0.08 };

// Sudut batang: arah ujung lengan Scutum Centaurus di r = 135
const BAR_ANGLE = Math.PI + Math.log(BAR_HALF_LENGTH / SCUTUM_REF) / K;

// Pembagian jumlah partikel. Totalnya 0,9: sisa 0,1 dicadangkan buat debu, nebula, dan halo (G3)
const SHARE = { bulge: 0.14, bar: 0.08, arms: 0.42, disk: 0.26 };

// Warna dalam linear RGB (dikalikan kecerahan di shader)
const COLORS = {
  bulge: [1.0, 0.78, 0.5],
  bar: [1.0, 0.82, 0.56],
  young: [0.62, 0.76, 1.0],
  white: [1.0, 0.96, 0.9],
  old: [1.0, 0.86, 0.66]
};

// RNG ber-seed (mulberry32): galaksinya sama persis tiap kali dibuka
function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createBuffers(name, count) {
  return {
    name,
    count,
    position: new Float32Array(count * 3),
    color: new Float32Array(count * 3),
    size: new Float32Array(count),
    seed: new Float32Array(count)
  };
}

export function generateGalaxy({ total, seed = 1 }) {
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

  // Ukuran partikel (unit galaksi) divariasikan, sebagian kecil jauh lebih besar (gugus terang)
  const sizeOf = (base) => base * (0.6 + random()) * (random() < 0.03 ? 2.2 : 1);

  // Bulge: elipsoid padat di pusat, makin ke tengah makin rapat (jarak berdistribusi eksponensial)
  function makeBulge(count) {
    const b = createBuffers('bulge', count);
    for (let i = 0; i < count; i++) {
      const r = -16 * Math.log(1 - random() * 0.995);
      const cosPhi = 2 * random() - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      const theta = random() * Math.PI * 2;
      const x = r * sinPhi * Math.cos(theta);
      const y = r * cosPhi * 0.55;
      const z = r * sinPhi * Math.sin(theta);
      write(b, i, x, y, z, COLORS.bulge, 0.75 + random() * 0.5, sizeOf(0.55));
    }
    return b;
  }

  // Batang: elips memanjang sepanjang BAR_ANGLE, menipis ke ujung
  function makeBar(count) {
    const b = createBuffers('bar', count);
    const cos = Math.cos(BAR_ANGLE);
    const sin = Math.sin(BAR_ANGLE);
    for (let i = 0; i < count; i++) {
      let along = gaussian() * 58;
      if (Math.abs(along) > BAR_HALF_LENGTH) along = (random() * 2 - 1) * BAR_HALF_LENGTH;
      const across = gaussian() * 15 * (1 - 0.55 * Math.abs(along) / BAR_HALF_LENGTH);
      const y = gaussian() * 6;
      write(b, i, along * cos - across * sin, y, along * sin + across * cos, COLORS.bar, 0.7 + random() * 0.5, sizeOf(0.55));
    }
    return b;
  }

  // Bintang muda di lengan: kebanyakan biru putih, sebagian putih dan kuning
  function armColor() {
    const pick = random();
    return pick < 0.6 ? COLORS.young : pick < 0.85 ? COLORS.white : COLORS.old;
  }

  // Satu titik di lengan pada jarak r: sudut dari rumus spiral, lalu disebar tegak lurus lengan.
  // Sekitar seperlima partikel ngumpul di gugus sepanjang lengan, biar lengannya bertekstur.
  // Gugusnya banyak, ukurannya beragam, dan isinya gak terlalu padat. Gugus yang sedikit dan padat
  // kelihatan kayak manik manik berjarak rata
  function placeOnArm(b, i, theta, r, width, clumps) {
    let x;
    let z;
    if (clumps && random() < 0.2) {
      const clump = clumps[Math.floor(random() * clumps.length)];
      const spread = clump.radius;
      x = clump.x + gaussian() * spread;
      z = clump.z + gaussian() * spread;
    } else {
      const spread = (5 + r * 0.035) * width;
      x = r * Math.cos(theta) + gaussian() * spread;
      z = r * Math.sin(theta) + gaussian() * spread;
    }
    const y = gaussian() * 1.6;
    const bright = random() < 0.02 ? 2.2 : 0.6 + random() * 0.8;
    write(b, i, x, y, z, armColor(), bright, sizeOf(0.4));
  }

  // r dengan kepadatan menurun eksponensial ke luar, dipotong di [rStart, rEnd]
  function sampleRadius(rStart, rEnd, scale) {
    const span = 1 - Math.exp(-(rEnd - rStart) / scale);
    return rStart - scale * Math.log(1 - random() * span);
  }

  const armTheta = (arm, r) => Math.PI + Math.log(r / arm.rRef) / K;

  function makeArms(count) {
    const b = createBuffers('arms', count);
    let i = 0;
    const totalWeight = ARMS.reduce((sum, arm) => sum + arm.weight, 0) + ORION.weight;

    for (const arm of ARMS) {
      const n = Math.round((count * arm.weight) / totalWeight);
      // Gugus bintang muda: titik pusat acak sepanjang lengan
      const clumps = Array.from({ length: Math.max(8, Math.round(n / 250)) }, () => {
        const r = sampleRadius(arm.rStart, arm.rEnd, 220);
        const theta = armTheta(arm, r);
        const spread = (4 + r * 0.03) * arm.width;
        return {
          x: r * Math.cos(theta) + gaussian() * spread,
          z: r * Math.sin(theta) + gaussian() * spread,
          radius: 2 + random() * random() * 7
        };
      });
      for (let j = 0; j < n && i < count; j++, i++) {
        const r = sampleRadius(arm.rStart, arm.rEnd, 220);
        placeOnArm(b, i, armTheta(arm, r), r, arm.width, clumps);
      }
    }

    // Sisanya buat taji Orion, potongan lengan pendek yang melewati Matahari
    while (i < count) {
      const theta = Math.PI + (random() * 2 - 1) * ORION.thetaSpan;
      const r = ORION.rRef * Math.exp(K * (theta - Math.PI));
      placeOnArm(b, i, theta, r, 0.55, null);
      i++;
    }
    return b;
  }

  // Piringan: bintang tua tersebar rata di sekitar lengan, kepadatan turun eksponensial ke luar,
  // makin ke luar sedikit makin tebal (flaring)
  function makeDisk(count) {
    const b = createBuffers('disk', count);
    for (let i = 0; i < count; i++) {
      const r = sampleRadius(18, DISK_RADIUS, 130);
      const theta = random() * Math.PI * 2;
      const y = gaussian() * (2.6 + r * 0.004);
      const base = random() < 0.7 ? COLORS.old : COLORS.white;
      write(b, i, r * Math.cos(theta), y, r * Math.sin(theta), base, 0.35 + random() * 0.45, sizeOf(0.45));
    }
    return b;
  }

  return [
    makeBulge(Math.round(total * SHARE.bulge)),
    makeBar(Math.round(total * SHARE.bar)),
    makeArms(Math.round(total * SHARE.arms)),
    makeDisk(Math.round(total * SHARE.disk))
  ];
}

self.onmessage = (event) => {
  const start = performance.now();
  const components = generateGalaxy(event.data);
  const ms = performance.now() - start;
  const transfer = components.flatMap((c) => [c.position.buffer, c.color.buffer, c.size.buffer, c.seed.buffer]);
  self.postMessage({ components, ms }, transfer);
};
