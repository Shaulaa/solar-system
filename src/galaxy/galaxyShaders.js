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
  uniform float uDustAlpha;
  varying vec3 vColor;
  varying float vAlpha;

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
    float energy = dim * dim;
    // seed dipakai buat variasi halus, biar gak ada dua partikel kembar
    float variation = 0.85 + 0.3 * seed;
  #ifdef DUST
    // Debu: warnanya tetap gelap, yang diatur seberapa nutup (alpha). Partikel debu cuma masuk akal
    // dilihat dari atas / serong. Dari samping atau dari dalam piringan peredamannya sudah diurus
    // ekstinksi di shader bintang, jadi debu yang garis pandangnya sejajar bidang dimatikan
    vec3 toPoint = normalize(position - uCameraLocal);
    float faceOn = smoothstep(0.12, 0.45, abs(toPoint.y));
    vColor = color;
    vAlpha = uDustAlpha * uOpacity * energy * faceOn * variation;
  #else
    float transmission = exp(-uExtinction * dustPath(uCameraLocal, position));
    vColor = color * uBrightness * uOpacity * transmission * energy * variation;
    vAlpha = 1.0;
  #endif
    gl_PointSize = clamp(projected, uMinSize, uMaxSize);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // r2 = 0 di tengah, 1 di tepi kotak titik
    vec2 p = gl_PointCoord - 0.5;
    float r2 = dot(p, p) * 4.0;
    // Gaussian lembut, dipaksa habis sebelum tepi biar gak kelihatan kotak
    float glow = exp(-r2 * 4.0) * (1.0 - smoothstep(0.6, 1.0, r2));
    if (glow < 0.002) discard;
  #ifdef DUST
    gl_FragColor = vec4(vColor, glow * vAlpha);
  #else
    gl_FragColor = vec4(vColor * glow, 1.0);
  #endif
  }
`;

// Setengah tebal lapisan debu (unit galaksi, 1 = 100 tahun cahaya) dan peredamannya per unit.
// 1 magnitudo per kiloparsec = 0,92 per 32,6 unit
const DUST_HALF_HEIGHT = 2.5;
const DUST_RADIUS = 520;
const EXTINCTION = 0.028;
// Seberapa nutup satu partikel debu di tengahnya
const DUST_ALPHA = 0.55;

// Jenis material partikel. Batas ukuran titik dalam piksel CSS (dikali pixel ratio di uniform)
//   star   bintang, maksimal kecil: yang didekati tampil sebagai titik tajam, bukan gumpalan
//   glow   gumpalan gas, boleh besar dan lembut
//   dust   debu gelap, NormalBlending (menutupi cahaya di belakangnya)
const KINDS = {
  star: { minSize: 2, maxSize: 8, blending: THREE.AdditiveBlending, dust: false },
  glow: { minSize: 2, maxSize: 320, blending: THREE.AdditiveBlending, dust: false },
  dust: { minSize: 2, maxSize: 24, blending: THREE.NormalBlending, dust: true }
};

export function createParticleMaterial(kind, { brightness = 1, pixelRatio = 1 } = {}) {
  const spec = KINDS[kind];
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelScale: { value: 1 },
      uMinSize: { value: spec.minSize * pixelRatio },
      uMaxSize: { value: spec.maxSize * pixelRatio },
      uBrightness: { value: brightness },
      uOpacity: { value: 0 },
      uCameraLocal: { value: new THREE.Vector3() },
      uDustHalfHeight: { value: DUST_HALF_HEIGHT },
      uDustRadius: { value: DUST_RADIUS },
      uExtinction: { value: EXTINCTION },
      uDustAlpha: { value: DUST_ALPHA }
    },
    defines: spec.dust ? { DUST: '' } : {},
    vertexShader,
    fragmentShader,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: spec.blending
  });
  material.userData.kind = kind;
  return material;
}

export function setMaterialPixelRatio(material, ratio) {
  const spec = KINDS[material.userData.kind];
  material.uniforms.uMinSize.value = spec.minSize * ratio;
  material.uniforms.uMaxSize.value = spec.maxSize * ratio;
}
