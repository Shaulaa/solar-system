// Kalender peristiwa langit setelah tanggal tertentu, dipakai dialog Peristiwa (ui/events.js)
//
//   opposition      planet luar berseberangan dengan Matahari dilihat dari Bumi: paling dekat
//                   dan paling terang, terbit waktu Matahari terbenam. Dihitung dari orbit Kepler
//                   (bujur heliosentris planet = bujur Bumi), melesetnya sekitar satu dua hari
//   perihelion      komet paling dekat ke Matahari (anomali rata rata = 0)
//   solarEclipse    dari daftar tetap data/eclipses.js (2026 sampai 2030)
//   lunarEclipse    sama
//   flyby           benda yang lewat dekat Bumi (closeApproach, sekarang cuma Apophis)
//
// Tiap peristiwa: { id, type, bodyId, time } dengan time = milidetik UTC. Gerhana juga bawa
// eclipse (entri aslinya) dan dateOnly, flyby bawa km.
// Modul ini fungsi murni (tanpa DOM / three.js), jadi bisa dites di Node

import { createKeplerOrbit } from '../utils/kepler.js';
import { planets, comets, asteroids } from './planets.js';
import { solarEclipses, lunarEclipses } from './eclipses.js';

const MS_PER_DAY = 86_400_000;
const J2000 = Date.UTC(2000, 0, 1, 12);
const TAU = Math.PI * 2;

const OUTER_PLANETS = ['mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
// Langkah pindai oposisi (hari). Selisih bujur planet luar terhadap Bumi berubah paling cepat
// sekitar 0,6 derajat per hari (Mars), jadi tanda selisihnya gak mungkin loncat dua kali dalam 5 hari
const SCAN_STEP = 5;
// Jam waktu gerhana: daftarnya cuma punya tanggal (UTC), jadi lompat ke tengah hari UTC
const ECLIPSE_HOUR = 12;

const days = (ms) => (ms - J2000) / MS_PER_DAY;
const toMs = (d) => J2000 + d * MS_PER_DAY;
const vector = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
const orbitOf = (data) => createKeplerOrbit(data.distance, data.orbitPeriod, data.orbit);

// Bujur ekliptika heliosentris (radian). Koordinat three.js: x = titik Aries, z = -y ekliptika
function longitude(orbit, d, out) {
  const p = orbit.positionAt(d, out);
  return Math.atan2(-p.z, p.x);
}

// Selisih sudut dibungkus ke (-PI, PI]
function wrap(angle) {
  const a = ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a === -Math.PI ? Math.PI : a;
}

function oppositions(fromDays, toDays) {
  const earth = orbitOf(planets.find((p) => p.id === 'earth'));
  const a = vector();
  const b = vector();
  const events = [];

  for (const id of OUTER_PLANETS) {
    const orbit = orbitOf(planets.find((p) => p.id === id));
    const gap = (d) => wrap(longitude(orbit, d, a) - longitude(earth, d, b));

    let prev = gap(fromDays);
    for (let d = fromDays + SCAN_STEP; d <= toDays + SCAN_STEP; d += SCAN_STEP) {
      const next = gap(d);
      // Bumi menyalip planet luar: selisihnya lewat 0 dari positif ke negatif. Lewat +-PI
      // (konjungsi, planet di balik Matahari) diabaikan
      if (prev > 0 && next <= 0 && prev - next < Math.PI) {
        let lo = d - SCAN_STEP;
        let hi = d;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if (gap(mid) > 0) lo = mid;
          else hi = mid;
        }
        const at = (lo + hi) / 2;
        if (at >= fromDays && at <= toDays) events.push({ type: 'opposition', bodyId: id, time: toMs(at) });
      }
      prev = next;
    }
  }
  return events;
}

// Perihelion (anomali rata rata = 0) pertama pada atau setelah fromDays, dalam hari sejak J2000.
// Elemen orbitnya sama dengan createKeplerOrbit. Dipakai juga panel info komet
function firstPerihelion(comet, fromDays) {
  const { perihelion, meanLongitude } = comet.orbit;
  const meanAnomalyAtJ2000 = (((meanLongitude - perihelion) % 360) + 360) % 360;
  // Hari sejak J2000 waktu anomali rata rata 360 derajat (perihelion pertama setelah J2000)
  const first = ((360 - meanAnomalyAtJ2000) / 360) * comet.orbitPeriod;
  return first + Math.ceil((fromDays - first) / comet.orbitPeriod) * comet.orbitPeriod;
}

// Saat perihelion berikutnya (milidetik UTC) setelah saat fromMs. comet = data komet ({ orbit, orbitPeriod })
export function nextPerihelion(comet, fromMs) {
  return toMs(firstPerihelion(comet, days(fromMs)));
}

function perihelia(fromDays, toDays) {
  const events = [];
  for (const comet of comets) {
    for (let d = firstPerihelion(comet, fromDays); d <= toDays; d += comet.orbitPeriod) {
      events.push({ type: 'perihelion', bodyId: comet.id, time: toMs(d) });
    }
  }
  return events;
}

function eclipses(fromMs, toMs_) {
  const list = [
    ...solarEclipses.map((eclipse) => ({ type: 'solarEclipse', bodyId: 'earth', eclipse })),
    ...lunarEclipses.map((eclipse) => ({ type: 'lunarEclipse', bodyId: 'moon', eclipse }))
  ];
  // dateOnly: jamnya cuma perkiraan, jadi yang ditampilkan tanggal UTC dari daftar, bukan jam lokal
  return list
    .map((e) => ({ ...e, dateOnly: true, time: Date.parse(`${e.eclipse.date}T${String(ECLIPSE_HOUR).padStart(2, '0')}:00:00Z`) }))
    .filter((e) => e.time >= fromMs && e.time <= toMs_);
}

function flybys(fromMs, toMs_) {
  return asteroids
    .filter((body) => body.closeApproach)
    .map((body) => ({ type: 'flyby', bodyId: body.id, time: Date.parse(body.closeApproach.time), km: body.closeApproach.km }))
    .filter((e) => e.time >= fromMs && e.time <= toMs_);
}

// Peristiwa setelah saat `fromMs` (milidetik UTC), urut waktu, paling banyak `limit`.
// horizonYears membatasi seberapa jauh ke depan dicari
export function upcomingEvents(fromMs, { limit = 12, horizonYears = 6 } = {}) {
  const endMs = fromMs + horizonYears * 365.25 * MS_PER_DAY;
  return [
    ...oppositions(days(fromMs), days(endMs)),
    ...perihelia(days(fromMs), days(endMs)),
    ...eclipses(fromMs, endMs),
    ...flybys(fromMs, endMs)
  ]
    .sort((a, b) => a.time - b.time)
    .slice(0, limit)
    .map((event) => ({ ...event, id: `${event.type}-${event.bodyId}-${new Date(event.time).toISOString().slice(0, 10)}` }));
}
