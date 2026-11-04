import * as THREE from 'three';
import { fbm } from './noise.js';

// Bikin tekstur planet di canvas
// Noise di-sample di permukaan bola (bukan di bidang datar), jadi gak ada sambungan aneh di pinggir tekstur
// Sejak fase 2 ini jadi fallback, dipakai kalau tekstur asli di public/textures gak ketemu

const W = 512;
const H = 256;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function ramp(colors, t) {
  t = Math.min(0.9999, Math.max(0, t));
  const scaled = t * (colors.length - 1);
  const i = Math.floor(scaled);
  return mix(colors[i], colors[i + 1], scaled - i);
}

const shaders = {
  rocky(x, y, z, c, seed) {
    const n = fbm(x * 3, y * 3, z * 3, 6, seed);
    const craters = fbm(x * 12, y * 12, z * 12, 3, seed + 99);
    let t = n * 1.4 - 0.2;
    if (craters > 0.68) t -= 0.18;
    return ramp(c, t);
  },

  cloudy(x, y, z, c, seed) {
    const warp = fbm(x * 2, y * 2, z * 2, 4, seed);
    const n = fbm(x * 1.5 + warp * 2, y * 4 + warp, z * 1.5, 5, seed + 3);
    return ramp(c, n * 1.3 - 0.15);
  },

  gas(x, y, z, c, seed) {
    const turbulence = fbm(x * 4, y * 4, z * 4, 4, seed) * 0.35;
    const bands = Math.sin((y + turbulence) * 18) * 0.5 + 0.5;
    const fine = fbm(x * 2, y * 30, z * 2, 3, seed + 7) * 0.3;
    return ramp(c, bands * 0.75 + fine);
  },

  ice(x, y, z, c, seed) {
    const turbulence = fbm(x * 3, y * 3, z * 3, 4, seed) * 0.15;
    const bands = Math.sin((y + turbulence) * 7) * 0.5 + 0.5;
    return ramp(c, bands * 0.5 + 0.25 + turbulence);
  },

  earth(x, y, z, c, seed) {
    const [deep, ocean, land, desert, ice] = c;
    const h = fbm(x * 2.2, y * 2.2, z * 2.2, 6, seed);
    const lat = Math.abs(y);

    if (lat > 0.88) return ice;

    if (h < 0.52) {
      return mix(deep, ocean, Math.min(1, (h - 0.3) / 0.22));
    }
    const dry = fbm(x * 4, y * 4, z * 4, 3, seed + 50);
    const base = dry > 0.55 && lat < 0.45 ? desert : land;
    const shade = 0.75 + (h - 0.52) * 1.2;
    return [base[0] * shade, base[1] * shade, base[2] * shade];
  },

  // Fallback nightmap Bumi. Rumus daratannya sama persis dengan shader earth di atas,
  // jadi selama seed-nya sama, lampu kota cuma muncul di daratan, gak di laut
  earthNight(x, y, z, c, seed) {
    const h = fbm(x * 2.2, y * 2.2, z * 2.2, 6, seed);
    const lat = Math.abs(y);
    if (lat > 0.88 || h < 0.52) return [0, 0, 0];
    const cities = fbm(x * 24, y * 24, z * 24, 3, seed + 200);
    const glow = Math.max(0, (cities - 0.58) / 0.42);
    return [255 * glow, 190 * glow, 110 * glow];
  },

  // Fallback awan, grayscale (putih = awan tebal) karena dipakai sebagai alphaMap
  clouds(x, y, z, c, seed) {
    const warp = fbm(x * 2, y * 2, z * 2, 3, seed);
    const n = fbm(x * 3 + warp * 1.5, y * 5, z * 3 + warp * 1.5, 5, seed + 11);
    const v = Math.min(1, Math.max(0, (n - 0.45) * 2.6)) * 255;
    return [v, v, v];
  }
};

// width / height bisa dikecilin buat benda kecil (bulan), biar generate-nya gak makan waktu startup
export function createPlanetTexture(look, seed = 1, { width = W, height = H } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const colors = look.colors.map(hexToRgb);
  const shade = shaders[look.type] ?? shaders.rocky;

  for (let py = 0; py < height; py++) {
    const lat = (py / (height - 1)) * Math.PI;
    const sinLat = Math.sin(lat);
    const y = Math.cos(lat);
    for (let px = 0; px < width; px++) {
      const lon = (px / width) * Math.PI * 2;
      const x = sinLat * Math.cos(lon);
      const z = sinLat * Math.sin(lon);
      const [r, g, b] = shade(x, y, z, colors, seed);
      const i = (py * width + px) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Fallback tekstur cincin Saturnus
// Bentuknya strip horizontal, kiri = tepi dalam, kanan = tepi luar (sama kayak 2k_saturn_ring_alpha.png).
// Kepadatan cincin disimpan di channel alpha (dibaca lewat map, sama kayak PNG aslinya),
// kecerahan warnanya juga ikut diturunin di bagian tipis biar celahnya kelihatan lebih dalam
export function createRingTexture(seed = 7) {
  const width = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, 1);
  const base = hexToRgb('#d9c49a');

  for (let px = 0; px < width; px++) {
    const t = px / (width - 1);
    // Garis garis halus cincin, plus celah Cassini sekitar 58 persen lebar
    let density = 0.35 + 0.65 * fbm(t * 40, 0.5, 0.5, 4, seed);
    density *= 1 - 0.9 * Math.exp(-Math.pow((t - 0.58) / 0.025, 2));
    // Tepi dalam dan luar dibikin memudar biar gak kepotong tajam
    density *= Math.min(1, t / 0.06) * Math.min(1, (1 - t) / 0.04);

    const shade = 0.55 + 0.45 * density;
    const i = px * 4;
    img.data[i] = base[0] * shade;
    img.data[i + 1] = base[1] * shade;
    img.data[i + 2] = base[2] * shade;
    img.data[i + 3] = density * 255;
  }

  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
