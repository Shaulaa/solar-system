import * as THREE from 'three';

// Shader partikel galaksi
//
// Ukuran partikel ikut jarak (size attenuation): ukuran asli (unit galaksi) dikali skala piksel
// lalu dibagi kedalaman. Ukuran yang digambar dibatasi
//   minimal  biar partikel jauh tetap kelihatan sebagai titik (gak hilang ditelan piksel)
//   maksimal biar partikel dekat gak jadi gumpalan raksasa
//
// Partikel yang aslinya lebih kecil dari batas minimal tetap digambar seukuran batas itu, tapi
// diredupkan sebanding luasnya (energi dijaga). Hasilnya kecerahan permukaan galaksi sama
// dari jarak berapa pun: dilihat jauh tetap padat terang, didekati pecah jadi titik tajam,
// tanpa ada yang tiba tiba makin terang atau gelap
//
// Ekstinksi debu: cahaya partikel diredam sebanding panjang garis pandang (kamera ke partikel)
// yang lewat di dalam lapisan debu tipis di bidang galaksi (|y| < uDustHalfHeight), dan cuma
// di dalam piringan (jarak ke sumbu galaksi < uDustRadius). Tanpa batas radius, kamera yang ada
// di perpanjangan bidang galaksi (di luar piringan) bakal "nembus debu" sepanjang ribuan unit
// dan galaksinya hilang total.
// Tanpa ini, dari dalam piringan atau dari samping, ratusan unit partikel numpuk jadi putih total.
// Koefisiennya sekitar 1 magnitudo per kiloparsec, kurang lebih angka asli Bima Sakti di cahaya
// tampak. Dilihat dari atas lapisannya tipis jadi hampir gak ngaruh. Debu yang kelihatan sebagai
// jalur gelap (dust lanes) itu urusan partikel debu di tahap G3

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float seed;
  // Piksel layar (device) per unit galaksi di kedalaman 1
  uniform float uPixelScale;
  uniform float uMinSize;
  uniform float uMaxSize;
  uniform float uBrightness;
  uniform float uOpacity;
  // Posisi kamera di koordinat galaksi (sama dengan atribut position)
  uniform vec3 uCameraLocal;
  uniform float uDustHalfHeight;
  uniform float uDustRadius;
  uniform float uExtinction;
  varying vec3 vColor;

  // Panjang segmen kamera ke titik ini yang ada di dalam lapisan debu: irisan
  // lapisan |y| < uDustHalfHeight dengan silinder jari jari uDustRadius di sekitar sumbu Y.
  // Segmen = from + t (to - from), t dari 0 sampai 1
  float dustPath(vec3 from, vec3 to) {
    vec3 d = to - from;
    float enter = 0.0;
    float leave = 1.0;

    if (abs(d.y) < 1e-4) {
      if (abs(from.y) >= uDustHalfHeight) return 0.0;
    } else {
      float t1 = (-uDustHalfHeight - from.y) / d.y;
      float t2 = (uDustHalfHeight - from.y) / d.y;
      enter = max(enter, min(t1, t2));
      leave = min(leave, max(t1, t2));
    }

    // |from.xz + t d.xz| < R  ->  a t^2 + 2 b t + c < 0
    float a = dot(d.xz, d.xz);
    float b = dot(from.xz, d.xz);
    float c = dot(from.xz, from.xz) - uDustRadius * uDustRadius;
    if (a < 1e-8) {
      if (c > 0.0) return 0.0;
    } else {
      float disc = b * b - a * c;
      if (disc <= 0.0) return 0.0;
      float root = sqrt(disc);
      enter = max(enter, (-b - root) / a);
      leave = min(leave, (-b + root) / a);
    }
    return length(d) * max(leave - enter, 0.0);
  }

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = max(-mv.z, 1e-6);
    float projected = size * uPixelScale / depth;
    float dim = min(projected / uMinSize, 1.0);
    float transmission = exp(-uExtinction * dustPath(uCameraLocal, position));
    // seed dipakai buat variasi kecerahan halus, biar gak ada dua partikel kembar
    vColor = color * uBrightness * uOpacity * transmission * dim * dim * (0.85 + 0.3 * seed);
    gl_PointSize = clamp(projected, uMinSize, uMaxSize);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;

  void main() {
    // r2 = 0 di tengah, 1 di tepi kotak titik
    vec2 p = gl_PointCoord - 0.5;
    float r2 = dot(p, p) * 4.0;
    // Gaussian lembut, dipaksa habis sebelum tepi biar gak kelihatan kotak
    float glow = exp(-r2 * 4.0) * (1.0 - smoothstep(0.6, 1.0, r2));
    if (glow < 0.002) discard;
    gl_FragColor = vec4(vColor * glow, 1.0);
  }
`;

// Batas ukuran titik dalam piksel CSS (dikali pixel ratio di uniform)
// Maksimalnya kecil: partikel yang didekati tampil sebagai bintang tajam, bukan gumpalan cahaya
export const MIN_POINT_SIZE = 2;
export const MAX_POINT_SIZE = 8;
// Setengah tebal lapisan debu (unit galaksi, 1 = 100 tahun cahaya) dan peredamannya per unit.
// 1 magnitudo per kiloparsec = 0,92 per 32,6 unit
const DUST_HALF_HEIGHT = 2.5;
const DUST_RADIUS = 520;
const EXTINCTION = 0.028;

// Material bintang (AdditiveBlending, cahaya numpuk). Debu nanti (G3) pakai NormalBlending sendiri
export function createStarMaterial({ brightness, pixelRatio }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelScale: { value: 1 },
      uMinSize: { value: MIN_POINT_SIZE * pixelRatio },
      uMaxSize: { value: MAX_POINT_SIZE * pixelRatio },
      uBrightness: { value: brightness },
      uOpacity: { value: 0 },
      uCameraLocal: { value: new THREE.Vector3() },
      uDustHalfHeight: { value: DUST_HALF_HEIGHT },
      uDustRadius: { value: DUST_RADIUS },
      uExtinction: { value: EXTINCTION }
    },
    vertexShader,
    fragmentShader,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}
