import * as THREE from 'three';
import { dwarfGalaxies } from '../data/dwarfGalaxies.js';

// 84 galaksi kerdil Grup Lokal (data/dwarfGalaxies.js) di tahap zoom paling luar
//
// Tiap galaksi satu titik bercahaya lembut di posisi aslinya, jadi kelihatan bentuk asli Grup Lokal:
// dua kerumunan, satelit di sekitar Bima Sakti dan di sekitar Andromeda, plus beberapa yang menyendiri
// di antaranya (WLM, Pegasus, Aquarius, Tucana). Gak ada label dan gak bisa diklik, cuma suasana.
//
//   ukuran      2 kali jari jari setengah cahaya, dibesarkan GALAXY_ENLARGE sama dengan galaksi lain.
//               Hampir semuanya tetap di bawah beberapa piksel, jadi dibatasi minimal MIN_SIZE
//   kecerahan   dari magnitudo mutlak, dikompres (yang asli rentangnya 15 magnitudo, sejuta kali lipat,
//               yang paling redup bakal hilang). Yang besar dan tersebar (Antlia II, Crater II) diredupkan
//               sebanding luasnya, karena cahayanya memang tersebar tipis
//   warna       kekuningan untuk galaksi kerdil bola dan elips (bintang tua), kebiruan untuk yang kaya gas
//
// Galaksi besar dibesarkan tapi posisinya tetap, jadi satelit yang dekat (Sagittarius, M32, M110) jatuh
// di dalam gambar Bima Sakti atau Andromeda dan bakal kelihatan sebagai noda di piringannya. Satelit di
// dalam jari jari galaksi induk yang sudah dibesarkan dipudarkan di shader

// Diameter minimal dan maksimal di layar (piksel CSS)
const MIN_SIZE = 3.5;
const MAX_SIZE = 40;
// Magnitudo mutlak ke kecerahan 0 sampai 1: segini paling terang, segini paling redup
const BRIGHT_MAG = -17;
const FAINT_MAG = -1;
// Kecerahan paling redup (galaksi kerdil ultra redup) biar tetap kelihatan samar
const MIN_BRIGHTNESS = 0.22;
const OLD = new THREE.Color(1.0, 0.82, 0.6);
const YOUNG = new THREE.Color(0.66, 0.8, 1.0);

const vertexShader = /* glsl */ `
  attribute float aRadius;
  attribute float aBrightness;
  attribute vec3 aColor;
  uniform float uPixelScale;
  uniform float uPixelRatio;
  uniform float uEnlarge;
  uniform vec4 uHostA;
  uniform vec4 uHostB;
  varying vec3 vColor;

  // 0 di dalam galaksi induk yang sudah dibesarkan, naik ke 1 di tepinya
  float outside(vec4 host) {
    return smoothstep(0.8, 1.05, distance(position, host.xyz) / (host.w * uEnlarge));
  }

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = max(-mv.z, 1e-6);
    float projected = 2.0 * aRadius * uEnlarge * uPixelScale / depth;
    float minSize = ${MIN_SIZE.toFixed(1)} * uPixelRatio;
    float size = clamp(projected, minSize, ${MAX_SIZE.toFixed(1)} * uPixelRatio);
    // Cahaya yang tersebar di bercak besar lebih redup per piksel, sebanding luasnya (kecerahan permukaan).
    // Antlia II (jari jari setengah cahaya sekitar 9.500 tahun cahaya tapi seredup Draco) jadi hampir hilang,
    // sama seperti aslinya yang baru ketemu tahun 2018
    float spread = clamp(pow(minSize * 2.5 / size, 2.0), 0.08, 1.0);
    vColor = aColor * aBrightness * spread * outside(uHostA) * outside(uHostB);
    gl_PointSize = size;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d2 = dot(p, p);
    if (d2 > 1.0) discard;
    // Galaksi kerdil gak punya inti tajam: profil lembut yang turun pelan ke tepi
    float glow = exp(-d2 * 3.5) * (1.0 - d2);
    gl_FragColor = vec4(vColor * glow * uOpacity, 1.0);
  }
`;

// Kecerahan 0 sampai 1 dari magnitudo mutlak (diekspor buat tes)
export function dwarfBrightness(absMag) {
  const t = THREE.MathUtils.clamp((FAINT_MAG - absMag) / (FAINT_MAG - BRIGHT_MAG), 0, 1);
  return MIN_BRIGHTNESS + (1 - MIN_BRIGHTNESS) * t;
}

// hosts = dua galaksi induk [{ position: [x, y, z], radius }] di koordinat yang sama dengan sunLocal,
// biasanya Bima Sakti dan Andromeda
export function createDwarfGalaxies({ sunLocal, pixelRatio = 1, hosts }) {
  const dwarfs = dwarfGalaxies(sunLocal);
  const count = dwarfs.length;
  const position = new Float32Array(count * 3);
  const radius = new Float32Array(count);
  const brightness = new Float32Array(count);
  const color = new Float32Array(count * 3);
  dwarfs.forEach((dwarf, i) => {
    position.set(dwarf.position, i * 3);
    radius[i] = dwarf.halfLight * 2;
    brightness[i] = dwarfBrightness(dwarf.absMag);
    (dwarf.gasRich ? YOUNG : OLD).toArray(color, i * 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  geometry.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3));

  const host = ({ position: [x, y, z], radius: r }) => new THREE.Vector4(x, y, z, r);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: 0 },
      uPixelScale: { value: 1 },
      uPixelRatio: { value: pixelRatio },
      uEnlarge: { value: 1 },
      uHostA: { value: host(hosts[0]) },
      uHostB: { value: host(hosts[1]) }
    }
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'local-group-dwarfs';
  points.visible = false;
  // Ukuran titiknya dari shader, bounding sphere geometry gak mewakili yang tergambar
  points.frustumCulled = false;

  return {
    points,
    count,
    setPixelRatio(ratio) {
      material.uniforms.uPixelRatio.value = ratio;
    },
    // pixelScale = piksel device per unit galaksi di jarak 1 (sama dengan partikel galaksi)
    update({ opacity, enlarge, pixelScale }) {
      material.uniforms.uOpacity.value = opacity;
      material.uniforms.uEnlarge.value = enlarge;
      material.uniforms.uPixelScale.value = pixelScale;
      points.visible = opacity > 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
