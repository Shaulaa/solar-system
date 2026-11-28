import * as THREE from 'three';
import { skyDirection } from '../utils/sky.js';

// Latar galaksi jauh di tahap Grup Lokal
//
// Di luar Grup Lokal (jari jari sekitar 5 juta tahun cahaya) ke segala arah ada galaksi lain: kelompok
// Sculptor, M81, Centaurus A di 10 sampai 15 juta tahun cahaya, lalu Gugus Virgo di sekitar 54 juta.
// Semuanya jauh di luar bingkai, jadi digambar sebagai latar di tak hingga (seperti langit bintang di
// tata surya): titik titik kecil lonjong yang gak bergeser waktu kamera mundur, cuma ikut arah pandang.
//
// Posisinya prosedural (bukan katalog), tapi sebarannya mengikuti struktur asli alam semesta dekat:
//   rata         sebagian tersebar merata ke semua arah
//   bidang       sebagian memadat di bidang supergalaksi (de Vaucouleurs), tempat galaksi galaksi dekat
//                berjajar, termasuk Grup Lokal sendiri
//   gugus        Gugus Virgo (arah RA 12h 27m, Dec +12° 43'), plus gugus gugus kecil acak di bidang itu
// Arah dihitung di koordinat ekuatorial lalu dipetakan lewat utils/sky.js, jadi bidangnya jatuh di
// arah langit yang benar relatif ke Bima Sakti dan Andromeda
//
// Tiap galaksi: elips kecil dengan arah dan kepepatan acak, kekuningan (elips, lebih banyak di gugus)
// atau putih kebiruan (spiral). Ukuran 1 sampai 4,5 piksel CSS, kebanyakan yang paling kecil

// Kutub utara supergalaksi dan titik nol bujurnya (SGL = 0, SGB = 0), koordinat J2000
const SUPERGALACTIC_POLE = { ra: 18.9169, dec: 15.7089 };
const SUPERGALACTIC_ZERO = { ra: 2.8206, dec: 59.5283 };
const VIRGO = { ra: 12.45, dec: 12.72 };

// Bagian tiap sebaran (sisanya rata) dan lebarnya (derajat)
const PLANE = { share: 0.38, spread: 14 };
const VIRGO_CLUSTER = { share: 0.08, spread: 6 };
const CLUSTERS = { count: 14, share: 0.14, spread: [1.5, 4.5] };
// Galaksi elips: di gugus dominan, di luar gugus minoritas
const ELLIPTICAL_SHARE = { field: 0.25, cluster: 0.7 };
// Ukuran (piksel CSS) dan kecerahan puncak. Yang besar lebih redup per piksel, biar kelihatan sebagai
// bercak lonjong yang lembut, bukan bintang terang
const SIZE = [1.4, 7];
const BRIGHTNESS = [0.08, 0.42];

const DEG = Math.PI / 180;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aBrightness;
  attribute float aAngle;
  attribute float aRatio;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAngle;
  varying float vRatio;

  void main() {
    // Arah saja (w = 0): latar di tak hingga, ikut rotasi kamera tapi gak bergeser waktu kamera pindah
    vec3 direction = mat3(modelViewMatrix) * position;
    gl_Position = projectionMatrix * vec4(direction, 1.0);
    // Ditaruh tepat di depan far plane, biar near plane kamera berapa pun gak memotongnya
    gl_Position.z = gl_Position.w * 0.99999;
    gl_PointSize = aSize * uPixelRatio;
    vColor = aColor * aBrightness;
    vAngle = aAngle;
    vRatio = aRatio;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAngle;
  varying float vRatio;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float c = cos(vAngle);
    float s = sin(vAngle);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    p.y /= vRatio;
    float d2 = dot(p, p);
    if (d2 > 1.0) discard;
    gl_FragColor = vec4(vColor * exp(-d2 * 3.0) * (1.0 - d2) * uOpacity, 1.0);
  }
`;

// Generator acak dengan seed (mulberry32), biar latarnya sama tiap kali dibuka
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

const vector = (array) => new THREE.Vector3().fromArray(array);

// Arah satuan di koordinat grup `galaxy` (sama dengan utils/sky.js skyDirection) untuk tiap galaksi latar.
// Diekspor buat tes: sebarannya harus memadat di bidang supergalaksi dan di arah Virgo
export function deepFieldDirections(count, seed = 1) {
  const random = createRandom(seed);
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

  const pole = vector(skyDirection(SUPERGALACTIC_POLE.ra, SUPERGALACTIC_POLE.dec));
  const zero = vector(skyDirection(SUPERGALACTIC_ZERO.ra, SUPERGALACTIC_ZERO.dec));
  const quarter = new THREE.Vector3().crossVectors(pole, zero);
  const virgo = vector(skyDirection(VIRGO.ra, VIRGO.dec));

  // Arah di bidang supergalaksi: bujur L, lintang B (radian)
  const onPlane = (L, B, out) =>
    out
      .copy(zero)
      .multiplyScalar(Math.cos(B) * Math.cos(L))
      .addScaledVector(quarter, Math.cos(B) * Math.sin(L))
      .addScaledVector(pole, Math.sin(B));

  // Titik acak di sekitar arah `center`, simpangan `spread` derajat
  const around = (center, spread, out) => {
    out.set(gaussian(), gaussian(), gaussian()).multiplyScalar(spread * DEG);
    return out.addScaledVector(center, 1).normalize();
  };

  const clusters = Array.from({ length: CLUSTERS.count }, () => ({
    center: onPlane(random() * Math.PI * 2, gaussian() * PLANE.spread * 0.5 * DEG, new THREE.Vector3()),
    spread: THREE.MathUtils.lerp(CLUSTERS.spread[0], CLUSTERS.spread[1], random())
  }));

  const result = [];
  for (let i = 0; i < count; i++) {
    const pick = random();
    const direction = new THREE.Vector3();
    let inCluster = false;
    if (pick < VIRGO_CLUSTER.share) {
      around(virgo, VIRGO_CLUSTER.spread, direction);
      inCluster = true;
    } else if (pick < VIRGO_CLUSTER.share + CLUSTERS.share) {
      const cluster = clusters[Math.floor(random() * clusters.length)];
      around(cluster.center, cluster.spread, direction);
      inCluster = true;
    } else if (pick < VIRGO_CLUSTER.share + CLUSTERS.share + PLANE.share) {
      onPlane(random() * Math.PI * 2, gaussian() * PLANE.spread * DEG, direction);
    } else {
      // Rata di bola: z rata di [-1, 1], sudut rata
      const z = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const ring = Math.sqrt(1 - z * z);
      direction.set(ring * Math.cos(angle), z, ring * Math.sin(angle));
    }
    result.push({ direction, inCluster });
  }
  return { directions: result, pole, virgo };
}

export function createDeepField({ count = 6000, pixelRatio = 1, seed = 20261128 } = {}) {
  const random = createRandom(seed ^ 0x9e3779b9);
  const { directions } = deepFieldDirections(count, seed);

  const position = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const brightness = new Float32Array(count);
  const angle = new Float32Array(count);
  const ratio = new Float32Array(count);
  const color = new Float32Array(count * 3);
  const elliptical = new THREE.Color(1.0, 0.84, 0.66);
  const spiral = new THREE.Color(0.78, 0.86, 1.0);
  const tint = new THREE.Color();

  directions.forEach(({ direction, inCluster }, i) => {
    direction.toArray(position, i * 3);
    // Pangkat besar: kebanyakan galaksi kecil dan redup, sedikit yang besar
    const big = Math.pow(random(), 3);
    size[i] = THREE.MathUtils.lerp(SIZE[0], SIZE[1], big);
    brightness[i] = THREE.MathUtils.lerp(BRIGHTNESS[0], BRIGHTNESS[1], Math.pow(random(), 2)) * (1 - big * 0.35);
    angle[i] = random() * Math.PI;
    const isElliptical = random() < (inCluster ? ELLIPTICAL_SHARE.cluster : ELLIPTICAL_SHARE.field);
    // Elips agak bulat, spiral bisa kelihatan dari samping (pipih)
    ratio[i] = isElliptical ? THREE.MathUtils.lerp(0.6, 1, random()) : THREE.MathUtils.lerp(0.25, 1, random());
    tint.copy(isElliptical ? elliptical : spiral).multiplyScalar(0.85 + random() * 0.3);
    tint.toArray(color, i * 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geometry.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
  geometry.setAttribute('aRatio', new THREE.BufferAttribute(ratio, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: 0 },
      uPixelRatio: { value: pixelRatio }
    }
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'deep-field';
  points.visible = false;
  points.frustumCulled = false;
  // Digambar paling dulu, di belakang semua galaksi
  points.renderOrder = -1;

  return {
    points,
    setPixelRatio(ratioValue) {
      material.uniforms.uPixelRatio.value = ratioValue;
    },
    setOpacity(opacity) {
      material.uniforms.uOpacity.value = opacity;
      points.visible = opacity > 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
