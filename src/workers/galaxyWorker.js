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

import { createParticleKit, createBuffers } from './particleKit.js';

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
  hii: [1.0, 0.32, 0.5],
  cluster: [0.55, 0.75, 1.0],
  gasPink: [1.0, 0.45, 0.62],
  gasBlue: [0.5, 0.68, 1.0],
  // Debu cokelat gelap. Dipakai dengan NormalBlending, jadi warnanya yang menimpa cahaya di belakangnya
  dust: [0.05, 0.035, 0.025]
};

const armTheta = (arm, r) => Math.PI - Math.log(r / arm.rRef) / K;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function generateGalaxy({ total, seed = 1 }) {
  const { random, gaussian, write, sizeOf, pickStar, sampleRadius } = createParticleKit(seed);

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

  // Lebar sebaran lengan di jarak r
  const armSpread = (r, width) => (5 + r * 0.035) * width;

  // Ketidakteraturan lengan. Tiap lengan punya dua fungsi acak (jumlah beberapa sinus dengan fase
  // ber-seed) sepanjang lengan, dengan parameter s = ln r:
  //   lebar      0,55 sampai 1,45 kali lebar dasar
  //   kepadatan  0,05 sampai 1, bagian yang rendah jadi lengan yang putus putus
  // Versi G3 lebar dan kepadatannya rata sepanjang lengan, dari atas kelihatan kayak cincin konsentris
  const WAVES = [
    { freq: 9, amp: 0.5 },
    { freq: 17, amp: 0.3 },
    { freq: 31, amp: 0.2 },
    { freq: 53, amp: 0.12 }
  ];
  const WAVE_TOTAL = WAVES.reduce((sum, w) => sum + w.amp, 0);
  const makeWave = () => WAVES.map(() => random() * Math.PI * 2);
  const armShape = new Map(ARMS.map((arm) => [arm, { width: makeWave(), density: makeWave() }]));
  const wave = (phases, r) => {
    const s = Math.log(r);
    let sum = 0;
    WAVES.forEach((w, i) => {
      sum += w.amp * Math.sin(w.freq * s + phases[i]);
    });
    return sum / WAVE_TOTAL;
  };
  const armWidthAt = (arm, r) => arm.width * (1 + 0.45 * wave(armShape.get(arm).width, r));
  const armDensityAt = (arm, r) => clamp(0.5 + 0.75 * wave(armShape.get(arm).density, r), 0.05, 1);

  // Jarak r di lengan, bagian yang kepadatannya rendah lebih jarang terpilih (lengan putus putus)
  function sampleArmRadius(arm, scale = 220) {
    for (let tries = 0; tries < 12; tries++) {
      const r = sampleRadius(arm.rStart, arm.rEnd, scale);
      if (random() < armDensityAt(arm, r)) return r;
    }
    return sampleRadius(arm.rStart, arm.rEnd, scale);
  }

  // Jarak radial titik (r, theta) ke garis tengah lengan terdekat. Di koordinat spiral
  // u = ln(r / rRef) + K (theta - PI) lengan ada di u = 0, berulang tiap 2 PI K
  const ARM_PERIOD = 2 * Math.PI * K;
  function distanceToArm(r, theta) {
    let best = Infinity;
    for (const arm of ARMS) {
      if (r < arm.rStart * 0.85 || r > arm.rEnd * 1.08) continue;
      let u = Math.log(r / arm.rRef) + K * (theta - Math.PI);
      u -= ARM_PERIOD * Math.round(u / ARM_PERIOD);
      best = Math.min(best, Math.abs(u) * r);
    }
    return best;
  }

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
    const star = pickStar('young');
    write(b, i, x, y, z, star.color, star.brightness, sizeOf(0.95));
  }

  // Cabang (spur) pendek: keluar dari sisi luar lengan dengan sudut pitch lebih terbuka (35 derajat),
  // makin ke ujung makin tipis. Gak tumbuh dari 40 unit terakhir lengan (di sana cabangnya
  // nongol ke ruang kosong dan kelihatan kayak garis lurus), dan cukup lebar biar gak jadi goresan
  const SPUR_K = Math.tan(35 * DEG);
  function makeSpurs(arm, count) {
    return Array.from({ length: count }, () => {
      let base = sampleArmRadius(arm);
      while (base > arm.rEnd - 40) base = sampleArmRadius(arm);
      const r0 = base + armSpread(base, arm.width) * 0.5;
      return { r0, theta0: armTheta(arm, r0), length: 10 + random() * 20 };
    });
  }
  function placeOnSpur(b, i, spur) {
    const t = random();
    const r = spur.r0 + t * spur.length;
    const theta = spur.theta0 - Math.log(r / spur.r0) / SPUR_K;
    const spread = (2.5 + random() * 3) * (1 - 0.5 * t);
    const x = r * Math.cos(theta) + gaussian() * spread;
    const z = r * Math.sin(theta) + gaussian() * spread;
    const star = pickStar('young');
    write(b, i, x, gaussian() * 1.4, z, star.color, star.brightness, sizeOf(0.95));
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
        const r = sampleArmRadius(arm);
        const theta = armTheta(arm, r);
        const spread = (4 + r * 0.03) * armWidthAt(arm, r);
        return {
          x: r * Math.cos(theta) + gaussian() * spread,
          z: r * Math.sin(theta) + gaussian() * spread,
          radius: 2 + random() * random() * 7
        };
      });
      // 10 persen partikel lengan ini jadi cabang
      const spurs = makeSpurs(arm, Math.max(4, Math.round(n / 2500)));
      const spurCount = Math.round(n * 0.1);
      for (let j = 0; j < n && i < count; j++, i++) {
        if (j < spurCount) {
          placeOnSpur(b, i, spurs[Math.floor(random() * spurs.length)]);
          continue;
        }
        const r = sampleArmRadius(arm);
        placeOnArm(b, i, armTheta(arm, r), r, armWidthAt(arm, r), clumps);
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

  // Piringan: bintang tua, kepadatan turun eksponensial ke luar, makin ke luar sedikit makin tebal
  // (flaring). Bintang tua juga ngumpul di sekitar lengan (gelombang kepadatan): titik yang jauh
  // dari lengan lebih sering ditolak, jadi celah antar lengan jauh lebih gelap. Di dalam radius 120
  // (daerah batang, belum ada lengan) piringannya tetap cukup rata
  const DISK_GAP_FLOOR = 0.18;
  function diskAcceptance(r, theta) {
    if (r < 120) return 0.7;
    const d = distanceToArm(r, theta) / (armSpread(r, 1) * 1.8);
    return DISK_GAP_FLOOR + (1 - DISK_GAP_FLOOR) * Math.exp(-d * d);
  }
  function makeDisk(count) {
    const b = createBuffers('disk', count);
    for (let i = 0; i < count; i++) {
      let r = 0;
      let theta = 0;
      for (let tries = 0; tries < 20; tries++) {
        r = sampleRadius(18, DISK_RADIUS, 130);
        theta = random() * Math.PI * 2;
        if (random() < diskAcceptance(r, theta)) break;
      }
      const y = gaussian() * (2.6 + r * 0.004);
      const star = pickStar('old');
      write(b, i, r * Math.cos(theta), y, r * Math.sin(theta), star.color, star.brightness * 0.6, sizeOf(0.85));
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
        const r = sampleArmRadius(arm, 240);
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
      const r = sampleArmRadius(arm, 260);
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
      const r = sampleArmRadius(arm, 260);
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
      const star = pickStar('old');
      write(
        b,
        i,
        r * sinPhi * Math.cos(theta),
        r * cosPhi,
        r * sinPhi * Math.sin(theta),
        star.color,
        star.brightness * 0.7,
        sizeOf(0.85)
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
