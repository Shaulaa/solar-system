import * as THREE from 'three';

// Ilustrasi galaksi Grup Lokal (Andromeda, Triangulum, Awan Magellan) buat tahap zoom paling jauh
//
// Di tahap Grup Lokal galaksinya cuma puluhan piksel (galaxy/zoomLevels.js, galaxyEnlargeAt), terlalu
// kecil buat partikel worker membentuk lengan atau batang yang terbaca. Jadi tiap galaksi dapat gambar
// yang dihitung di shader dari data bentuknya sendiri (data/localGroup.js, shape), tanpa tekstur:
//
//   piringan   bidang datar di bidang galaksi (XZ lokal, sumbu panjang +X, sama dengan partikelnya).
//              Spiral: piringan eksponensial, lengan spiral logaritmik (rumus lengan sama dengan
//              workers/localGroupWorker.js), jalur debu di sisi dalam lengan, gumpalan HII merah muda.
//              Tak beraturan: batang yang bergeser dari pusat, gumpalan bintang muda, nebula, tepi acak
//   inti       quad yang selalu menghadap kamera, jadi intinya tetap kelihatan waktu piringan dilihat
//              dari samping (piringan datar tinggal garis). Spiral: tonjolan inti yang terang dan kecil.
//              Tak beraturan: awan cahaya lebar dan lembut, karena Awan Magellan itu tebal, bukan
//              piringan tipis, jadi dari sudut mana pun harus tetap kelihatan menggumpal
//
// Blending aditif tanpa depth write, sama dengan partikel galaksi. Karena gambarnya ikut kemiringan
// piringan asli, Andromeda dari arah Bumi kelihatan lonjong miring seperti fotonya, dari arah lain
// kelihatan sesuai sudut itu. Waktu dilihat miring, luas piringan di layar menyusut tapi cahayanya
// tetap (gas dan bintang tembus pandang, garis pandangnya makin panjang), jadi kecerahan permukaannya
// dinaikkan sebanding 1 / cos sudut pandang, dibatasi biar tepi yang pas dari samping gak menyilaukan

const DEG = Math.PI / 180;
const TYPES = { spiral: 0, irregular: 1 };
// Batas bawah |cos sudut pandang| buat penguat kecerahan (paling banyak 1 / 0,4 = 2,5 kali). Lebih kecil
// dari ini piringan luar Andromeda (dari arah kamera Grup Lokal hampir dari samping) jadi pelat terang bertepi tajam
const MIN_FACING = 0.4;
// Inti: jari jari (spiral kelipatan sebaran bulge, tak beraturan kelipatan jari jari piringan),
// ketajaman gradien, dan kecerahannya relatif ke piringan
const CORE = {
  spiral: { scale: 2, falloff: 7, intensity: 1.1 },
  irregular: { scale: 0.45, falloff: 2.2, intensity: 0.35 }
};
// Kecerahan dasar. Di atas ini warna lengan dan inti sudah mentok putih setelah tone mapping
const INTENSITY = 0.55;

// Data shape (unit galaksi) ke parameter shader, ukuran dinormalkan ke jari jari piringan
export function galaxyArtParams(shape) {
  const type = TYPES[shape.type];
  if (type === undefined) throw new Error(`Bentuk galaksi "${shape.type}" belum punya ilustrasi`);
  const { radius } = shape;
  const stretch = shape.stretch ?? 1;
  const params = {
    type,
    radius,
    stretch,
    halfSize: [radius * stretch, radius],
    diskScale: shape.scale / radius
  };
  if (shape.type === 'spiral') {
    const { arms, bulge } = shape;
    return {
      ...params,
      arms: arms.count,
      armTan: Math.tan(arms.pitch * DEG),
      armStart: arms.rStart / radius,
      bulge: bulge.spread / radius,
      coreRadius: bulge.spread * CORE.spiral.scale,
      core: CORE.spiral
    };
  }
  const { bar, nebula } = shape;
  return {
    ...params,
    bar: [bar.offset[0] / radius, bar.offset[1] / radius, bar.halfLength / radius, bar.width / radius],
    nebula: [nebula.at[0] / radius, nebula.at[1] / radius],
    coreRadius: radius * CORE.irregular.scale,
    core: CORE.irregular
  };
}

const diskVertex = /* glsl */ `
  uniform float uRadius;
  uniform float uStretch;
  // Posisi di bidang galaksi dalam satuan jari jari, sumbu panjang sudah dikembalikan dari regangannya
  varying vec2 vPos;
  varying float vFacing;

  void main() {
    vPos = vec2(position.x / uStretch, position.z) / uRadius;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 normal = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
    vFacing = abs(dot(normal, normalize(cameraPosition - world.xyz)));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const diskFragment = /* glsl */ `
  uniform float uType;
  uniform float uOpacity;
  uniform float uIntensity;
  uniform float uSeed;
  uniform float uDiskScale;
  uniform float uArms;
  uniform float uArmTan;
  uniform float uArmStart;
  uniform float uBulge;
  uniform vec4 uBar;
  uniform vec2 uNebula;
  uniform float uMinFacing;
  varying vec2 vPos;
  varying float vFacing;

  const vec3 OLD = vec3(1.0, 0.82, 0.62);
  const vec3 YOUNG = vec3(0.62, 0.78, 1.0);
  const vec3 HII = vec3(1.0, 0.36, 0.56);
  const vec3 CORE = vec3(1.0, 0.8, 0.55);
  const float TAU = 6.28318530718;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
  }

  // Empat oktaf cukup: galaksinya paling besar beberapa ratus piksel
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + 17.1;
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 spiral(vec2 p) {
    float r = length(p);
    float theta = atan(p.y, p.x);
    vec2 q = p * 5.0 + uSeed;
    float warp = fbm(q) - 0.5;
    // Fase terhadap lengan terdekat: cos(...) = 1 tepat di lengan, sama dengan armTheta di worker
    float phase = theta - log(max(r, uArmStart) / uArmStart) / uArmTan + warp * 0.9;
    float onArm = 0.5 + 0.5 * cos(uArms * phase);
    float armZone = smoothstep(uArmStart * 0.5, uArmStart * 1.6, r);
    float arm = pow(onArm, 2.5) * armZone;
    // Debu di sisi dalam lengan (fase sedikit di belakang), berbintik
    float lane = pow(0.5 + 0.5 * cos(uArms * (phase + 0.45)), 6.0) * armZone * smoothstep(0.25, 0.7, fbm(q * 1.7));
    float hii = smoothstep(0.62, 0.8, fbm(p * 22.0 + uSeed * 3.0)) * arm;
    float disk = exp(-r / uDiskScale);
    // Tonjolan inti di piringan sedikit lebih lebar dari sebaran bintang bulge-nya, biar terbaca di ukuran kecil
    float bulge = exp(-0.5 * (r * r) / (4.0 * uBulge * uBulge));
    vec3 color = OLD * disk * (0.4 + 0.3 * onArm) + YOUNG * arm * exp(-r / (uDiskScale * 1.4)) * 0.7 + HII * hii * 1.2;
    color *= 1.0 - 0.75 * lane * (1.0 - bulge);
    return color + CORE * bulge * 1.6;
  }

  vec3 irregular(vec2 p) {
    float r = length(p);
    float theta = atan(p.y, p.x);
    vec2 q = p * 4.0 + uSeed;
    // Piringan bergelombang seperti partikelnya, dengan tepi acak dari noise
    float wave = 0.55 + 0.45 * sin(2.0 * theta + uSeed + r * 4.4);
    float disk = exp(-r / uDiskScale) * wave * (0.5 + fbm(q));
    vec2 d = p - uBar.xy;
    float bar = exp(-0.5 * pow(d.x / (uBar.z * 0.55), 2.0)) * exp(-0.5 * pow(d.y / uBar.w, 2.0));
    float clumps = smoothstep(0.6, 0.78, fbm(p * 9.0 + uSeed * 2.0)) * exp(-r / (uDiskScale * 1.4));
    float nebula = exp(-dot(p - uNebula, p - uNebula) / 0.004);
    return OLD * (disk * 0.5 + bar * 0.8) + YOUNG * clumps * 0.9 + HII * nebula * 1.4;
  }

  void main() {
    float r = length(vPos);
    if (r > 1.0) discard;
    vec3 color = uType < 0.5 ? spiral(vPos) : irregular(vPos);
    // Tepi memudar pelan dan bergerigi dari noise. Awan Magellan mulai memudar lebih ke dalam, biar kelihatan
    // seperti awan, bukan piringan bertepi
    float fadeFrom = uType < 0.5 ? 0.45 : 0.3;
    float edge = 1.0 - smoothstep(fadeFrom, 1.0, r + (fbm(vPos * 3.0 + uSeed) - 0.5) * 0.3);
    float boost = 1.0 / max(vFacing, uMinFacing);
    gl_FragColor = vec4(color * edge * boost * uIntensity * uOpacity, 1.0);
  }
`;

// Inti: quad yang selalu menghadap kamera, ukurannya (uSize, unit lokal) ikut skala anchor
const coreVertex = /* glsl */ `
  uniform float uSize;
  varying vec2 vCorner;

  void main() {
    vCorner = position.xy;
    vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    center.xy += position.xy * uSize * length(modelMatrix[0].xyz);
    gl_Position = projectionMatrix * center;
  }
`;

const coreFragment = /* glsl */ `
  uniform float uOpacity;
  uniform float uIntensity;
  uniform float uFalloff;
  varying vec2 vCorner;

  void main() {
    float d2 = dot(vCorner, vCorner);
    if (d2 > 1.0) discard;
    float glow = exp(-d2 * uFalloff) * (1.0 - d2);
    gl_FragColor = vec4(vec3(1.0, 0.82, 0.6) * glow * uIntensity * uOpacity, 1.0);
  }
`;

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

// shape = data/localGroup.js shape, seed = angka acak tetap per galaksi (pola noise beda tiap galaksi)
export function createGalaxyArt(shape, { seed = 0, intensity = INTENSITY } = {}) {
  const params = galaxyArtParams(shape);
  const group = new THREE.Group();
  group.name = 'galaxy-art';

  const diskGeometry = new THREE.PlaneGeometry(params.halfSize[0] * 2, params.halfSize[1] * 2).rotateX(-Math.PI / 2);
  const diskMaterial = new THREE.ShaderMaterial({
    ...additive,
    side: THREE.DoubleSide,
    vertexShader: diskVertex,
    fragmentShader: diskFragment,
    uniforms: {
      uType: { value: params.type },
      uOpacity: { value: 0 },
      uIntensity: { value: intensity },
      uSeed: { value: seed },
      uRadius: { value: params.radius },
      uStretch: { value: params.stretch },
      uDiskScale: { value: params.diskScale },
      uArms: { value: params.arms ?? 0 },
      uArmTan: { value: params.armTan ?? 1 },
      uArmStart: { value: params.armStart ?? 0.1 },
      uBulge: { value: params.bulge ?? 0.05 },
      uBar: { value: new THREE.Vector4(...(params.bar ?? [0, 0, 1, 1])) },
      uNebula: { value: new THREE.Vector2(...(params.nebula ?? [2, 2])) },
      uMinFacing: { value: MIN_FACING }
    }
  });
  const disk = new THREE.Mesh(diskGeometry, diskMaterial);
  disk.name = 'galaxy-art-disk';
  group.add(disk);

  const coreGeometry = new THREE.PlaneGeometry(2, 2);
  const coreMaterial = new THREE.ShaderMaterial({
    ...additive,
    vertexShader: coreVertex,
    fragmentShader: coreFragment,
    uniforms: {
      uSize: { value: params.coreRadius },
      uOpacity: { value: 0 },
      uIntensity: { value: intensity * params.core.intensity },
      uFalloff: { value: params.core.falloff }
    }
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.name = 'galaxy-art-core';
  // Geometry-nya cuma 2 x 2 di titik asal, ukuran aslinya dari shader, jadi bounding-nya gak bisa dipercaya
  core.frustumCulled = false;
  group.add(core);

  group.visible = false;

  return {
    group,
    setOpacity(alpha) {
      diskMaterial.uniforms.uOpacity.value = alpha;
      coreMaterial.uniforms.uOpacity.value = alpha;
      group.visible = alpha > 0;
    },
    dispose() {
      diskGeometry.dispose();
      diskMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
    }
  };
}
