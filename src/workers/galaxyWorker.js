// Web Worker pembuat partikel galaksi Bima Sakti
//
// Dijalankan di thread terpisah biar halaman gak freeze waktu ratusan ribu partikel dihitung.
// Hasilnya dikirim balik sebagai Float32Array transferable (pindah kepemilikan, gak disalin).
//
// Koordinat galaksi (1 unit = 100 tahun cahaya): pusat galaksi di (0,0,0), piringan di bidang XZ,
// sumbu Y = kutub utara galaksi, Matahari di (-260, 0.65, 0). Sudut theta = atan2(z, x),
// jadi Matahari ada di theta = PI.
//
// Arah lengan mengikuti Bima Sakti asli (dan ilustrasi NASA/JPL-Caltech yang dipakai sebagai lapisan
// tekstur): dilihat dari kutub utara, lengan melengkung berlawanan jarum jam ke arah luar dan
// galaksi berputar searah jarum jam. Di koordinat ini artinya theta MENGECIL ke arah luar.
//
// Komponen
//   bulge, bar, arms, disk, halo   bintang (AdditiveBlending)
//   nebula                         titik terang merah muda (nebula HII) dan biru (gugus muda)
//   glow                           gumpalan gas besar dan lembut di sepanjang lengan
//   dust                           debu gelap di sisi dalam lengan (NormalBlending)
//
// Pesan masuk   { total, seed }
// Pesan keluar  { components: [{ name, count, position, color, size, seed }], ms }

const DEG = Math.PI / 180;

// Lengan spiral logaritmik dengan sudut pitch 12 derajat: r = rRef * exp(-k * (theta - PI))
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

// Sudut batang: arah ujung lengan Scutum Centaurus di r = 135. Ujung dekatnya ada di sisi -Z,
// arah gerak Matahari (bujur galaksi positif), seperti batang Bima Sakti asli
const BAR_ANGLE = Math.PI - Math.log(BAR_HALF_LENGTH / SCUTUM_REF) / K;

// Pembagian jumlah partikel (totalnya 1)
const SHARE = {
  bulge: 0.14,
  bar: 0.08,
  arms: 0.42,
  disk: 0.26,
  dust: 0.06,
  nebula: 0.015,
  halo: 0.025
};
// Gumpalan gas jumlahnya tetap (bukan persentase), ukurannya besar jadi gak perlu banyak
const GLOW_COUNT = { full: 180, small: 70 };

// Warna dalam linear RGB (dikalikan kecerahan di shader)
const COLORS = {
  bulge: [1.0, 0.78, 0.5],
  bar: [1.0, 0.82, 0.56],
  young: [0.62, 0.76, 1.0],
  white: [1.0, 0.96, 0.9],
  old: [1.0, 0.86, 0.66],
  hii: [1.0, 0.32, 0.5],
  cluster: [0.55, 0.75, 1.0],
  gasPink: [1.0, 0.45, 0.62],
  gasBlue: [0.5, 0.68, 1.0],
  // Debu cokelat gelap. Dipakai dengan NormalBlending, jadi warnanya yang menimpa cahaya di belakangnya
  dust: [0.05, 0.035, 0.025]
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

const armTheta = (arm, r) => Math.PI - Math.log(r / arm.rRef) / K;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

  // r dengan kepadatan menurun eksponensial ke luar, dipotong di [rStart, rEnd]
  function sampleRadius(rStart, rEnd, scale) {
    const span = 1 - Math.exp(-(rEnd - rStart) / scale);
    return rStart - scale * Math.log(1 - random() * span);
  }

  // Bulge: elipsoid gaussian (kepadatannya terbatas di tengah). Versi G2 pakai jarak berdistribusi
  // eksponensial, yang kepadatannya tak hingga di titik pusat: intinya terlalu terang dan
  // pendar bloom-nya berbentuk kotak. Inti kecil yang lebih rapat tetap ada (15 persen)
  function makeBulge(count) {
    const b = createBuffers('bulge', count);
    for (let i = 0; i < count; i++) {
      const spread = random() < 0.15 ? 8 : 22;
      const x = gaussian() * spread;
      const y = gaussian() * spread * 0.6;
      const z = gaussian() * spread;
      write(b, i, x, y, z, COLORS.bulge, 0.7 + random() * 0.5, sizeOf(0.6));
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

  // Lebar sebaran lengan di jarak r
  const armSpread = (r, width) => (5 + r * 0.035) * width;

  // Satu titik di lengan pada jarak r: sudut dari rumus spiral, lalu disebar tegak lurus lengan.
  // Seperlima partikel ngumpul di gugus sepanjang lengan, biar lengannya bertekstur.
  // Gugusnya banyak, ukurannya beragam, dan isinya gak terlalu padat. Gugus yang sedikit dan padat
  // kelihatan kayak manik manik berjarak rata
  function placeOnArm(b, i, theta, r, width, clumps) {
    let x;
    let z;
    if (clumps && random() < 0.2) {
      const clump = clumps[Math.floor(random() * clumps.length)];
      x = clump.x + gaussian() * clump.radius;
      z = clump.z + gaussian() * clump.radius;
    } else {
      const spread = armSpread(r, width);
      x = r * Math.cos(theta) + gaussian() * spread;
      z = r * Math.sin(theta) + gaussian() * spread;
    }
    const y = gaussian() * 1.6;
    const bright = random() < 0.02 ? 2.2 : 0.6 + random() * 0.8;
    write(b, i, x, y, z, armColor(), bright, sizeOf(0.4));
  }

  // Titik acak sepanjang semua lengan, dengan bobot tiap lengan. Dipakai komponen yang
  // nempel ke lengan (nebula, gas, debu)
  const armWeightTotal = ARMS.reduce((sum, arm) => sum + arm.weight, 0);
  function pickArm() {
    let pick = random() * armWeightTotal;
    for (const arm of ARMS) {
      pick -= arm.weight;
      if (pick <= 0) return arm;
    }
    return ARMS[0];
  }

  function makeArms(count) {
    const b = createBuffers('arms', count);
    let i = 0;
    const totalWeight = armWeightTotal + ORION.weight;

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
      const r = ORION.rRef * Math.exp(-K * (theta - Math.PI));
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

  // Debu: jalur gelap tipis di sisi dalam (cekung) tiap lengan, pecah jadi dua tiga untaian
  // biar kelihatan berserat. Sepersepuluhnya jadi jalur debu di dua sisi depan batang
  function makeDust(count) {
    const b = createBuffers('dust', count);
    const barCount = Math.round(count * 0.1);
    const cos = Math.cos(BAR_ANGLE);
    const sin = Math.sin(BAR_ANGLE);
    // Titik tengah potongan jalur debu batang, acak di sepanjang batang (kedua sisi pusat).
    // Bagian dalam (di bawah BAR_DUST_INNER) dikosongkan: jalur debu batang gak lewat inti,
    // kalau lewat jadinya garis gelap yang membelah bulge
    const BAR_DUST_INNER = 38;
    const dustSegments = Array.from({ length: 18 }, () => {
      const side = random() < 0.5 ? -1 : 1;
      return side * (BAR_DUST_INNER + random() * (BAR_HALF_LENGTH * 0.95 - BAR_DUST_INNER));
    });
    for (let i = 0; i < count; i++) {
      let x;
      let z;
      if (i < barCount) {
        // Jalur debu batang seperti di galaksi berbatang asli: di sisi depan batang (searah putaran),
        // simetris titik (bentuk S), makin ke ujung makin menjauh dari sumbu batang dan nyambung
        // ke sisi dalam lengan. Partikelnya ngumpul di potongan potongan pendek biar putus putus,
        // bukan garis lurus rata (versi pertama kelihatan kayak dua goresan)
        const segment = dustSegments[Math.floor(random() * dustSegments.length)];
        const sign = segment >= 0 ? 1 : -1;
        const along = sign * clamp(Math.abs(segment) + gaussian() * 5, BAR_DUST_INNER, BAR_HALF_LENGTH);
        const t = Math.abs(along) / BAR_HALF_LENGTH;
        const across = sign * (10 + 18 * t * t) + gaussian() * (1.5 + 2.5 * t);
        x = along * cos - across * sin;
        z = along * sin + across * cos;
      } else {
        const arm = pickArm();
        const r = sampleRadius(arm.rStart, arm.rEnd, 240);
        const strand = Math.floor(random() * 3);
        // Ke arah pusat dari garis tengah lengan, tiap untaian sedikit beda jarak
        const inner = r - armSpread(r, arm.width) * (0.55 + strand * 0.25);
        const theta = armTheta(arm, r) + gaussian() * 0.01;
        const jitter = 0.8 + inner * 0.004;
        x = inner * Math.cos(theta) + gaussian() * jitter;
        z = inner * Math.sin(theta) + gaussian() * jitter;
      }
      const y = gaussian() * 0.6;
      write(b, i, x, y, z, COLORS.dust, 1, 1.2 + random() * 1.4);
    }
    return b;
  }

  // Nebula HII (merah muda) dan gugus bintang muda (biru) yang terang, berkelompok kecil
  // di tepi luar jalur debu
  function makeNebula(count) {
    const b = createBuffers('nebula', count);
    let i = 0;
    while (i < count) {
      const arm = pickArm();
      const r = sampleRadius(arm.rStart, arm.rEnd, 260);
      const theta = armTheta(arm, r);
      const center = r - armSpread(r, arm.width) * 0.2 + gaussian() * 3;
      const cx = center * Math.cos(theta);
      const cz = center * Math.sin(theta);
      const hii = random() < 0.65;
      const members = 10 + Math.floor(random() * 30);
      const radius = 0.5 + random() * 1.4;
      for (let j = 0; j < members && i < count; j++, i++) {
        write(
          b,
          i,
          cx + gaussian() * radius,
          gaussian() * 0.5,
          cz + gaussian() * radius,
          hii ? COLORS.hii : COLORS.cluster,
          1.6 + random() * 1.6,
          0.35 + random() * 0.4
        );
      }
    }
    return b;
  }

  // Gumpalan gas besar dan sangat redup di sepanjang lengan, kesan awan gas yang lembut
  function makeGlow(count) {
    const b = createBuffers('glow', count);
    for (let i = 0; i < count; i++) {
      const arm = pickArm();
      const r = sampleRadius(arm.rStart, arm.rEnd, 260);
      const theta = armTheta(arm, r) + gaussian() * 0.02;
      const x = r * Math.cos(theta) + gaussian() * 4;
      const z = r * Math.sin(theta) + gaussian() * 4;
      const base = random() < 0.6 ? COLORS.gasPink : COLORS.gasBlue;
      write(b, i, x, gaussian() * 1, z, base, 0.5 + random() * 0.5, 14 + random() * 26);
    }
    return b;
  }

  // Halo: bintang tua sangat jarang berbentuk bola. Jarak berdistribusi log rata
  // (kepadatan turun kira kira 1/r^3), dari 50 sampai 700 unit
  function makeHalo(count) {
    const b = createBuffers('halo', count);
    for (let i = 0; i < count; i++) {
      const r = 50 * Math.exp(random() * Math.log(14));
      const cosPhi = 2 * random() - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      const theta = random() * Math.PI * 2;
      write(
        b,
        i,
        r * sinPhi * Math.cos(theta),
        r * cosPhi,
        r * sinPhi * Math.sin(theta),
        COLORS.old,
        0.5 + random() * 0.5,
        sizeOf(0.5)
      );
    }
    return b;
  }

  const count = (share) => Math.round(total * share);
  return [
    makeBulge(count(SHARE.bulge)),
    makeBar(count(SHARE.bar)),
    makeArms(count(SHARE.arms)),
    makeDisk(count(SHARE.disk)),
    makeHalo(count(SHARE.halo)),
    makeNebula(count(SHARE.nebula)),
    makeGlow(total >= 300_000 ? GLOW_COUNT.full : GLOW_COUNT.small),
    makeDust(count(SHARE.dust))
  ];
}

self.onmessage = (event) => {
  const start = performance.now();
  const components = generateGalaxy(event.data);
  const ms = performance.now() - start;
  const transfer = components.flatMap((c) => [c.position.buffer, c.color.buffer, c.size.buffer, c.seed.buffer]);
  self.postMessage({ components, ms }, transfer);
};
