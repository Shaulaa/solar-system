import * as THREE from 'three';
import { createTexturedSphere } from './planets.js';
import { scaleKm, blendScale } from '../utils/scale.js';

// Komet: inti kecil, koma (awan gas di sekitar inti), dan dua ekor yang selalu menjauhi Matahari
//   ekor ion   lurus, kebiruan, tipis
//   ekor debu  kekuningan, lebih lebar, melengkung ke belakang arah gerak komet
//
// Inti dibentuk seperti badan planet biasa (ditempel ke tiltGroup lewat scene/planets.js). Koma dan
// ekor satu THREE.Points di grup `attachment` yang ditempel ke anchor (gak ikut skala radius inti),
// diputar tiap frame: sumbu Z lokal = arah menjauhi Matahari, sumbu X lokal = arah belakang gerak komet.
// Posisi tiap partikel dihitung di vertex shader dari parameter (panjang, lebar koma), jadi tiap frame
// cuma beberapa uniform yang berubah. Partikel ekor mengalir keluar pelan pelan (uTime)
//
// Komet cuma aktif dekat Matahari: koma dan ekornya tumbuh di bawah ACTIVE_FROM AU dan hilang di luar itu

const ACTIVE_FROM = 4.5;
const ACTIVE_RANGE = 3.5;
// Panjang ekor (AU) dihitung di jarak radial dari Matahari, lalu diubah ke unit scene pakai rumus jarak
// mode skala (ekor memang searah radial). Di mode Enak Dilihat jarak dikompres, ekornya jadi pendek
// sekali, jadi dilebihkan segini kali (di mode Skala Nyata gak dilebihkan)
const PRETTY_TAIL_BOOST = 3;
// Radius koma (unit scene): mode Enak Dilihat dan mode Skala Nyata (sekitar 100 ribu km waktu aktif)
const COMA_PRETTY = { min: 0.06, active: 0.22 };
const COMA_REAL_KM = 100_000;
// Ekor debu melengkung ke belakang sejauh segini kali panjangnya di ujung ekor
const DUST_CURVE = 0.22;
const PARTICLES = { coma: 500, ion: 500, dust: 800 };
const BRIGHTNESS = 0.13;
// Batas ukuran titik (piksel CSS). Titik yang terlalu besar bikin koma jadi gumpalan kabur
const MAX_POINT = 14;

const vertexShader = /* glsl */ `
  attribute float aT;
  attribute vec3 aOffset;
  attribute float aKind;
  attribute float aSeed;
  uniform float uTime;
  uniform float uLength;
  uniform float uComa;
  uniform float uActivity;
  uniform float uOpacity;
  uniform float uCurve;
  uniform float uPixelScale;
  uniform float uPixelRatio;
  uniform float uBrightness;
  uniform float uMaxPoint;
  varying vec3 vColor;

  void main() {
    vec3 p;
    vec3 color;
    float bright;
    float size;
    if (aKind < 0.5) {
      // Koma: bola gaussian di sekitar inti, paling terang di tengah
      p = aOffset * uComa;
      color = vec3(0.82, 0.9, 1.0);
      bright = 1.2;
      size = uComa * 0.3;
    } else {
      bool ion = aKind < 1.5;
      float t = fract(aT + uTime * (ion ? 0.3 : 0.1));
      float width = uComa * (ion ? 0.25 : 0.7) + uLength * t * (ion ? 0.03 : 0.14);
      p = vec3(aOffset.x * width, aOffset.y * width, t * uLength * (ion ? 1.0 : 0.8));
      if (!ion) p.x += uCurve * uLength * t * t;
      color = ion ? vec3(0.45, 0.68, 1.0) : vec3(1.0, 0.88, 0.68);
      // Memudar ke ujung, muncul halus di pangkal (partikel yang baru lahir gak kedip)
      bright = pow(1.0 - t, 1.5) * smoothstep(0.0, 0.06, t);
      size = uComa * 0.25 + uLength * t * 0.02;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float projected = size * uPixelScale / max(-mv.z, 1e-6);
    float minSize = 1.5 * uPixelRatio;
    gl_PointSize = clamp(projected, minSize, uMaxPoint * uPixelRatio);
    // Partikel yang aslinya lebih kecil dari minSize diredupkan sebanding luasnya (sama seperti galaksi)
    float energy = min(projected / minSize, 1.0);
    vColor = color * bright * uBrightness * uActivity * uOpacity * energy * energy * (0.6 + 0.4 * aSeed);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r2 = dot(p, p) * 4.0;
    float glow = exp(-r2 * 4.0) * (1.0 - smoothstep(0.6, 1.0, r2));
    if (glow < 0.003) discard;
    gl_FragColor = vec4(vColor * glow, 1.0);
  }
`;

// Bilangan acak ber-seed (mulberry32) biar bentuk ekornya sama tiap kali dibuka
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

function createTailGeometry(seed) {
  const random = createRandom(seed);
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const total = PARTICLES.coma + PARTICLES.ion + PARTICLES.dust;
  const t = new Float32Array(total);
  const offset = new Float32Array(total * 3);
  const kind = new Float32Array(total);
  const seeds = new Float32Array(total);
  let i = 0;
  for (const [name, count, k] of [['coma', PARTICLES.coma, 0], ['ion', PARTICLES.ion, 1], ['dust', PARTICLES.dust, 2]]) {
    for (let j = 0; j < count; j++, i++) {
      t[i] = random();
      const spread = name === 'coma' ? 0.45 : 0.5;
      offset[i * 3] = gaussian() * spread;
      offset[i * 3 + 1] = gaussian() * spread;
      offset[i * 3 + 2] = gaussian() * spread;
      kind[i] = k;
      seeds[i] = random();
    }
  }
  const geometry = new THREE.BufferGeometry();
  // three.js butuh atribut position buat ngitung jumlah titik. Isinya gak dipakai shader
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3));
  geometry.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offset, 3));
  geometry.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

// Badan komet, bentuknya sama dengan createBody di scene/planets.js plus:
//   attachment            grup koma + ekor, ditempel ke anchor
//   updateSun(...)        dipanggil tiap frame setelah posisi komet final
//   boundingRadius()      radius koma + pangkal ekor sekarang (unit scene), buat jarak kamera waktu difokus
export function createComet(data, radius, seed) {
  const mesh = createTexturedSphere(data, radius, seed, { segments: 24 });

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLength: { value: 0 },
      uComa: { value: COMA_PRETTY.min },
      uActivity: { value: 0 },
      // Diatur scene/solarFade.js waktu zoom keluar
      uOpacity: { value: 1 },
      uCurve: { value: DUST_CURVE },
      uPixelScale: { value: 1 },
      uPixelRatio: { value: 1 },
      uBrightness: { value: BRIGHTNESS },
      uMaxPoint: { value: MAX_POINT }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const tail = new THREE.Points(createTailGeometry(seed * 7919), material);
  tail.name = `${data.id}-tail`;
  tail.frustumCulled = false;
  const drawingSize = new THREE.Vector2();
  tail.onBeforeRender = (renderer, scene, camera) => {
    renderer.getDrawingBufferSize(drawingSize);
    material.uniforms.uPixelScale.value = drawingSize.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  };

  const attachment = new THREE.Group();
  attachment.name = `${data.id}-coma`;
  attachment.add(tail);

  const away = new THREE.Vector3();
  const behind = new THREE.Vector3();
  const side = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const clock = new THREE.Clock();
  let coma = COMA_PRETTY.min;
  let length = 0;

  return {
    group: mesh,
    mesh,
    attachment,
    // Kamera fokus memuat koma dan pangkal ekornya
    boundingRadius: () => coma * 2 + length * 0.35,
    update(spin) {
      mesh.rotation.y = spin;
    },
    // helio = posisi komet dari Matahari (AU), velocity = arah geraknya, k = mode skala (0 pretty, 1 real),
    // scaleAt(au, k) = jarak dari Matahari ke unit scene
    updateSun(helio, velocity, k, scaleAt) {
      const r = helio.length();
      const activity = Math.pow(THREE.MathUtils.clamp((ACTIVE_FROM - r) / ACTIVE_RANGE, 0, 1), 1.5);
      const lengthAU = data.tail.length * activity * Math.sqrt(0.6 / Math.max(r, 0.6));
      const boost = blendScale(PRETTY_TAIL_BOOST, 1, k);
      length = (scaleAt(r + lengthAU, k) - scaleAt(r, k)) * boost;
      coma = blendScale(
        COMA_PRETTY.min + (COMA_PRETTY.active - COMA_PRETTY.min) * activity,
        scaleKm(COMA_REAL_KM) * (0.2 + activity),
        k
      );

      const u = material.uniforms;
      u.uActivity.value = activity;
      u.uLength.value = length;
      u.uComa.value = coma;
      u.uTime.value = clock.getElapsedTime();
      attachment.visible = activity > 0;
      if (activity <= 0) return;

      // Z = menjauhi Matahari, X = belakang arah gerak (tegak lurus Z), Y melengkapi
      away.copy(helio).normalize();
      behind.copy(velocity).negate().addScaledVector(away, velocity.dot(away)).normalize();
      side.crossVectors(away, behind);
      basis.makeBasis(behind, side, away);
      attachment.quaternion.setFromRotationMatrix(basis);
    }
  };
}
