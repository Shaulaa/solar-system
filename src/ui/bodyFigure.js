import { solveKepler } from '../utils/kepler.js';
import { moonPhase } from '../utils/moon.js';
import { START_DAYS_SINCE_J2000 } from '../utils/time.js';
import { planets } from '../data/planets.js';
import { SPECTRAL_COLOR } from '../data/nearbyStars.js';
import { t, LOCALE } from '../i18n/index.js';

// Gambar di panel info, semuanya dihitung dari data asli benda (bukan hiasan)
//
//   peta      posisi di tata surya: orbit planet planet (redup), orbit benda ini (terang), dan posisinya
//             di tanggal simulasi, dilihat dari atas. Jarak dikompres akar kuadrat biar Merkurius
//             sampai Neptunus muat. Bulan planet pakai orbit planet induknya
//   ukuran    perbandingan ukuran sebenarnya dengan Bumi (bulan dibandingkan dengan Bulan kita).
//             Komet dan asteroid cuma dapat peta, intinya terlalu kecil buat dibandingkan
//   fase      Bulan: bagian piringan yang terang di tanggal simulasi
//   suhu      bintang tetangga: posisinya di skala suhu, dari katai merah sampai bintang biru
//
// Warna aksen tiap benda (bodyColor) dipakai panel buat pendar, keterangan, dan titik di gambar.
// SVG dirakit dari angka hasil hitungan sendiri dan teks kamus, dipasang lewat innerHTML

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const EARTH_COLOR = '#5b8fd6';
const MOON_COLOR = '#b9b6ae';
const number0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const fixed = (value) => value.toFixed(2);

// Warna yang mewakili benda: warna tekstur prosedural planet / bulan, warna kelas spektral bintang
export function bodyColor(body) {
  const { data, kind } = body;
  if (kind === 'nearby-star') return SPECTRAL_COLOR[data.type] ?? SPECTRAL_COLOR.G;
  if (kind === 'local-galaxy' || kind === 'galaxy' || kind === 'local-group') return '#e8d9bd';
  if (kind === 'star') return '#ffb36b';
  if (kind === 'comet') return '#9fd0ff';
  if (data.id === 'earth') return EARTH_COLOR;
  return vividest(data.look?.colors ?? []) ?? '#e8e8f0';
}

// Warna paling berwarna (saturasi tertinggi) yang gak terlalu gelap / terang dari palet benda.
// Palet tekstur planet urut gelap ke terang, warna paling terang biasanya pucat (Jupiter krem)
function vividest(colors) {
  let best = null;
  let bestScore = -1;
  for (const hex of colors) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 2;
    const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
    const score = saturation * (1 - Math.abs(light - 0.55) * 1.4);
    if (score > bestScore) {
      bestScore = score;
      best = hex;
    }
  }
  return best;
}

function svg(width, height, label, content) {
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}">${content}</svg>`;
}

function figure(kind, caption, drawing) {
  return `<figure class="figure figure-${kind}">${drawing}<figcaption>${caption}</figcaption></figure>`;
}

// Posisi di bidang orbit (AU) dan sudutnya di ekliptika, dilihat dari kutub utara
function orbitPoint(data, E) {
  const { eccentricity: e, perihelion } = data.orbit;
  const a = data.distance;
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return { r: Math.hypot(x, y), angle: Math.atan2(y, x) + perihelion * DEG };
}

function meanAnomaly(data, simDays) {
  const { perihelion, meanLongitude } = data.orbit;
  const days = START_DAYS_SINCE_J2000 + simDays;
  return ((((meanLongitude - perihelion) * DEG + (TAU * days) / data.orbitPeriod) % TAU) + TAU) % TAU;
}

// Benda yang orbitnya gak keluar dari orbit Mars (asteroid dekat Bumi) cukup digambar sampai Mars,
// kalau sampai Neptunus orbitnya cuma titik di tengah
const INNER_LIMIT = 1.6;

function mapFigure(data, simDays, color) {
  const size = 140;
  const c = size / 2;
  const aphelion = data.distance * (1 + data.orbit.eccentricity);
  const mars = planets.find((p) => p.id === 'mars').distance;
  const limit = aphelion < INNER_LIMIT ? mars : planets[planets.length - 1].distance;
  const outer = Math.max(limit, aphelion) * 1.04;
  const radius = (r) => (c - 6) * Math.sqrt(r / outer);
  const point = ({ r, angle }) => [c + radius(r) * Math.cos(angle), c - radius(r) * Math.sin(angle)];

  const rings = planets
    .filter((p) => p.distance <= limit)
    .map((p) => `<circle class="map-ring${p.id === data.id ? ' is-self' : ''}" cx="${c}" cy="${c}" r="${fixed(radius(p.distance))}" />`)
    .join('');
  const steps = 160;
  const path = Array.from({ length: steps + 1 }, (_, i) => point(orbitPoint(data, (i / steps) * TAU)))
    .map(([x, y], i) => `${i ? 'L' : 'M'}${fixed(x)} ${fixed(y)}`)
    .join(' ');
  const [bx, by] = point(orbitPoint(data, solveKepler(meanAnomaly(data, simDays), data.orbit.eccentricity)));
  const drawing = svg(
    size,
    size,
    t('figure.mapAria'),
    `${rings}
    <path class="map-path" d="${path} Z" pathLength="1" style="stroke:${color}" />
    <circle class="map-sun" cx="${c}" cy="${c}" r="3" />
    <circle class="map-halo" cx="${fixed(bx)}" cy="${fixed(by)}" r="7" style="stroke:${color}" />
    <circle class="map-body" cx="${fixed(bx)}" cy="${fixed(by)}" r="3.2" style="fill:${color}" />`
  );
  return figure('map', t('figure.map'), drawing);
}

// Dua piringan dengan perbandingan radius asli, rata bawah. Yang terlalu kecil tetap minimal 1 px
function sizeFigure(subject, reference) {
  const width = 140;
  const height = 140;
  const space = 30;
  const largest = Math.max(subject.radius, reference.radius);
  const scale = (height - space - 6) / 2 / largest;
  const r1 = Math.max(reference.radius * scale, 1);
  const r2 = Math.max(subject.radius * scale, 1);
  const gap = 10;
  const total = r1 * 2 + gap + r2 * 2;
  const shrink = total > width - 8 ? (width - 8) / total : 1;
  const a = r1 * shrink;
  const b = r2 * shrink;
  const start = (width - (a * 2 + gap + b * 2)) / 2;
  const base = height - space;
  const x1 = start + a;
  const x2 = start + a * 2 + gap + b;
  const label = (x, text) => `<text class="size-label" x="${fixed(x)}" y="${base + 18}" text-anchor="middle">${text}</text>`;
  const drawing = svg(
    width,
    height,
    t('figure.sizeAria', { subject: subject.name, reference: reference.name }),
    `<line class="size-base" x1="4" y1="${base}" x2="${width - 4}" y2="${base}" />
    <circle class="size-disc" cx="${fixed(x1)}" cy="${fixed(base - a)}" r="${fixed(a)}" style="fill:${reference.color}" />
    <circle class="size-disc" cx="${fixed(x2)}" cy="${fixed(base - b)}" r="${fixed(b)}" style="fill:${subject.color}" />
    ${label(x1, reference.name)}${label(x2, subject.name)}`
  );
  return figure('size', t('figure.size'), drawing);
}

// Piringan Bulan. Sisi kanan terang waktu membesar (dilihat dari belahan Bumi utara), terminatornya elips
function phaseFigure(simDays) {
  const { fraction, illumination } = moonPhase(START_DAYS_SINCE_J2000 + simDays);
  const size = 140;
  const R = 46;
  const c = size / 2;
  const k = Math.cos(fraction * TAU);
  const top = `${c} ${c - R}`;
  const bottom = `${c} ${c + R}`;
  const waxing = fraction < 0.5;
  // Tepi terang setengah lingkaran, lalu balik lewat terminator. Bulan sabit: terminator melengkung ke
  // arah tepi terang, cembung: menjauh darinya
  const limb = waxing ? `A ${R} ${R} 0 0 1 ${bottom}` : `A ${R} ${R} 0 0 0 ${bottom}`;
  const sweep = waxing === k > 0 ? 0 : 1;
  const lit = illumination < 0.005 ? '' : `<path class="phase-lit" d="M ${top} ${limb} A ${fixed(R * Math.abs(k))} ${R} 0 0 ${sweep} ${top} Z" />`;
  const percent = Math.round(illumination * 100);
  const drawing = svg(size, size, t('figure.phaseAria', { percent }), `<circle class="phase-disc" cx="${c}" cy="${c}" r="${R}" />${lit}`);
  return figure('phase', t('figure.phase', { percent }), drawing);
}

// Skala suhu permukaan bintang (kelvin), warnanya dari kelas M sampai B
const TEMPERATURE_RANGE = [2500, 11000];
function temperatureFigure(data, color) {
  const width = 300;
  const height = 64;
  const [low, high] = TEMPERATURE_RANGE;
  const t01 = Math.min(Math.max((data.temperature - low) / (high - low), 0), 1);
  const x = 12 + t01 * (width - 24);
  const stops = ['M', 'K', 'G', 'F', 'A', 'B']
    .map((type, i, list) => `<stop offset="${fixed((i / (list.length - 1)) * 100)}%" stop-color="${SPECTRAL_COLOR[type]}" />`)
    .join('');
  const drawing = svg(
    width,
    height,
    t('figure.temperatureAria', { kelvin: number0.format(data.temperature) }),
    `<defs><linearGradient id="temperature-scale">${stops}</linearGradient></defs>
    <rect class="temp-bar" x="12" y="${height - 20}" width="${width - 24}" height="4" rx="2" fill="url(#temperature-scale)" />
    <circle class="temp-star" cx="${fixed(x)}" cy="${height - 18}" r="9" style="fill:${color}" />
    <text class="temp-value" x="${fixed(Math.min(Math.max(x, 40), width - 40))}" y="${height - 36}" text-anchor="middle">${number0.format(data.temperature)} K</text>
    <text class="temp-end" x="12" y="${height - 2}">${t('figure.cool')}</text>
    <text class="temp-end" x="${width - 12}" y="${height - 2}" text-anchor="end">${t('figure.hot')}</text>`
  );
  return `<figure class="figure figure-temperature">${drawing}</figure>`;
}

// Benda pembanding ukuran (radius dalam radius Bumi)
const EARTH = () => ({ name: planets.find((p) => p.id === 'earth').name, radius: 1, color: EARTH_COLOR });
const MOON = () => {
  const moon = planets.find((p) => p.id === 'earth').moons[0];
  return { name: moon.name, radius: moon.radius, color: MOON_COLOR };
};
const SUN_RADIUS_EARTHS = 109.1;

// Markup gambar buat benda ini di hari simulasi simDays, atau null kalau gak ada yang bisa digambar.
// parent = data planet induk (khusus bulan)
export function bodyFigures(body, simDays, { parent } = {}) {
  const { data, kind } = body;
  const color = bodyColor(body);
  const self = (radius) => ({ name: body.name, radius, color });

  if (kind === 'nearby-star' && data.temperature) return temperatureFigure(data, color);
  if (kind === 'star') return sizeFigure(self(SUN_RADIUS_EARTHS), EARTH());

  const figures = [];
  if (data.id === 'moon') {
    figures.push(phaseFigure(simDays), sizeFigure(self(data.radius), EARTH()));
  } else if (kind === 'moon' && parent) {
    figures.push(mapFigure(parent, simDays, color), sizeFigure(self(data.radius), MOON()));
  } else if ((kind === 'planet' || kind === 'dwarf') && data.orbit) {
    figures.push(mapFigure(data, simDays, color), sizeFigure(self(data.radius), data.id === 'earth' ? MOON() : EARTH()));
  } else if ((kind === 'comet' || kind === 'asteroid') && data.orbit) {
    figures.push(mapFigure(data, simDays, color));
  }
  return figures.length ? figures.join('') : null;
}
