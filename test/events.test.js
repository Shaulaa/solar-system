import { describe, expect, it } from 'vitest';
import { upcomingEvents, nextPerihelion } from '../src/data/events.js';
import { comets } from '../src/data/planets.js';

const DAY = 86_400_000;
const at = (iso) => Date.parse(`${iso}T00:00:00Z`);

// Tanggal oposisi asli (almanak). Model Kepler dari elemen J2000 boleh meleset sampai 2 hari
const KNOWN_OPPOSITIONS = [
  ['mars', '2027-02-19'],
  ['mars', '2029-03-25'],
  ['jupiter', '2026-01-10'],
  ['saturn', '2026-10-04'],
  ['uranus', '2026-11-25'],
  ['neptune', '2026-09-26']
];

describe('kalender peristiwa', () => {
  const events = upcomingEvents(at('2025-06-01'), { limit: 200, horizonYears: 5 });

  it.each(KNOWN_OPPOSITIONS)('oposisi %s sekitar %s', (id, iso) => {
    const near = events.find((e) => e.type === 'opposition' && e.bodyId === id && Math.abs(e.time - at(iso)) < 30 * DAY);
    expect(near).toBeDefined();
    expect(Math.abs(near.time - at(iso))).toBeLessThan(2 * DAY);
  });

  it('gak ada oposisi ganda (konjungsi gak ikut kehitung)', () => {
    const mars = events.filter((e) => e.type === 'opposition' && e.bodyId === 'mars');
    for (let i = 1; i < mars.length; i++) expect(mars[i].time - mars[i - 1].time).toBeGreaterThan(700 * DAY);
  });

  it('urut waktu, id unik, semuanya setelah tanggal awal', () => {
    for (let i = 1; i < events.length; i++) expect(events[i].time).toBeGreaterThanOrEqual(events[i - 1].time);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    expect(events.every((e) => e.time >= at('2025-06-01'))).toBe(true);
  });

  it('memuat gerhana, perihelion komet, dan Apophis', () => {
    expect(events.some((e) => e.type === 'solarEclipse' && e.eclipse.date === '2026-08-12')).toBe(true);
    expect(events.some((e) => e.type === 'lunarEclipse' && e.eclipse.date === '2026-03-03')).toBe(true);
    expect(events.some((e) => e.type === 'perihelion' && e.bodyId === 'encke')).toBe(true);
    expect(events.find((e) => e.type === 'flyby')?.bodyId).toBe('apophis');
  });

  it('dibatasi limit dan horizon', () => {
    expect(upcomingEvents(at('2026-01-01'), { limit: 5 })).toHaveLength(5);
    expect(upcomingEvents(at('2026-01-01'), { limit: 100, horizonYears: 0.01 })).toHaveLength(0);
  });
});

// Periode sinodis (hari) dan simpangan yang wajar. Orbit Mars cukup lonjong, jadi jarak antar oposisinya
// bervariasi sekitar dua bulan
const SYNODIC = { mars: [780, 50], jupiter: [399, 6], saturn: [378, 4], uranus: [370, 3], neptune: [367.5, 3] };

describe('kalender peristiwa jangka jauh', () => {
  it('daftar yang dibuka dialog selalu urut, unik, dan setelah tanggal awal (tiap bulan 2026 sampai 2050)', () => {
    for (let ms = at('2026-01-01'); ms < at('2050-01-01'); ms += 30 * DAY) {
      const list = upcomingEvents(ms);
      for (let i = 1; i < list.length; i++) expect(list[i].time).toBeGreaterThanOrEqual(list[i - 1].time);
      expect(new Set(list.map((e) => e.id)).size).toBe(list.length);
      expect(list.every((e) => e.time >= ms)).toBe(true);
    }
  });

  it.each(Object.entries(SYNODIC))('oposisi %s berjarak satu periode sinodis selama 30 tahun', (id, [period, tolerance]) => {
    const list = upcomingEvents(at('2026-01-01'), { limit: 5000, horizonYears: 30 }).filter(
      (e) => e.type === 'opposition' && e.bodyId === id
    );
    expect(list.length).toBeGreaterThan(10);
    for (let i = 1; i < list.length; i++) expect(Math.abs((list[i].time - list[i - 1].time) / DAY - period)).toBeLessThan(tolerance);
  });

  it('oposisi Jupiter 2032 jatuh di bulan Juli', () => {
    const jupiter = upcomingEvents(at('2032-01-01'), { limit: 50, horizonYears: 1 }).filter(
      (e) => e.type === 'opposition' && e.bodyId === 'jupiter'
    );
    expect(jupiter).toHaveLength(1);
    expect(new Date(jupiter[0].time).getUTCMonth()).toBe(6);
  });
});

describe('perihelion komet berikutnya', () => {
  const halley = comets.find((c) => c.id === 'halley');
  const encke = comets.find((c) => c.id === 'encke');

  it('Halley balik sekitar Juli 2061, dihitung dari tanggal mana pun sebelumnya', () => {
    for (const from of ['2026-11-28', '1990-01-01', '2061-01-01']) {
      const time = nextPerihelion(halley, at(from));
      expect(new Date(time).getUTCFullYear()).toBe(2061);
    }
  });

  it('selalu setelah tanggal awal dan kurang dari satu periode sesudahnya', () => {
    for (const from of ['2026-11-28', '2035-06-15', '2048-02-01']) {
      const time = nextPerihelion(encke, at(from));
      expect(time).toBeGreaterThanOrEqual(at(from));
      expect(time - at(from)).toBeLessThanOrEqual(encke.orbitPeriod * DAY);
    }
  });

  it('sama dengan perihelion di kalender peristiwa', () => {
    const fromCalendar = upcomingEvents(at('2030-01-01'), { limit: 100 }).find((e) => e.type === 'perihelion' && e.bodyId === 'encke');
    expect(nextPerihelion(encke, at('2030-01-01'))).toBe(fromCalendar.time);
  });
});
