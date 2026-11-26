import { describe, expect, it } from 'vitest';
import { upcomingEvents } from '../src/data/events.js';

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
