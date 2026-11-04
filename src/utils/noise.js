// Value noise 3D sederhana + fbm
// Dipake buat bikin tekstur planet secara prosedural, jadi project bisa jalan tanpa file gambar

function hash(x, y, z, seed) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h & 0xffffff) / 0xffffff;
}

const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);

  const c000 = hash(xi, yi, zi, seed);
  const c100 = hash(xi + 1, yi, zi, seed);
  const c010 = hash(xi, yi + 1, zi, seed);
  const c110 = hash(xi + 1, yi + 1, zi, seed);
  const c001 = hash(xi, yi, zi + 1, seed);
  const c101 = hash(xi + 1, yi, zi + 1, seed);
  const c011 = hash(xi, yi + 1, zi + 1, seed);
  const c111 = hash(xi + 1, yi + 1, zi + 1, seed);

  const x00 = lerp(c000, c100, xf);
  const x10 = lerp(c010, c110, xf);
  const x01 = lerp(c001, c101, xf);
  const x11 = lerp(c011, c111, xf);

  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
}

export function fbm(x, y, z, octaves = 5, seed = 0) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise3(x * freq, y * freq, z * freq, seed + i * 17);
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / total;
}
