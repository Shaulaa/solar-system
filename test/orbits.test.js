import { describe, expect, it } from 'vitest';
import { createKeplerOrbit } from '../src/utils/kepler.js';
import { scaleDistance, unscaleDistance, blendScale, scaleRadius } from '../src/utils/scale.js';
import { planets, comets, dwarfPlanets, asteroids } from '../src/data/planets.js';

const J2000 = Date.UTC(2000, 0, 1, 12);
const daysSinceJ2000 = (iso) => (Date.parse(`${iso}T00:00:00Z`) - J2000) / 86_400_000;
const vector = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
const distance = (p) => Math.hypot(p.x, p.y, p.z);

function orbitOf(data) {
  return createKeplerOrbit(data.distance, data.orbitPeriod, data.orbit);
}

describe('orbit Kepler', () => {
  it('Bumi selalu di antara perihelion dan aphelion aslinya', () => {
    const earth = orbitOf(planets.find((p) => p.id === 'earth'));
    for (let day = 0; day < 366; day += 5) {
      const r = distance(earth.positionAt(day, vector()));
      expect(r).toBeGreaterThan(0.982);
      expect(r).toBeLessThan(1.018);
    }
  });

  it('Bumi di perihelion awal Januari dan aphelion awal Juli', () => {
    const earth = orbitOf(planets.find((p) => p.id === 'earth'));
    const january = distance(earth.positionAt(daysSinceJ2000('2026-01-03'), vector()));
    const july = distance(earth.positionAt(daysSinceJ2000('2026-07-04'), vector()));
    expect(january).toBeLessThan(0.985);
    expect(july).toBeGreaterThan(1.015);
  });

  it('Halley di perihelion 1986 dan 2061 (orbit sangat lonjong, e = 0,967)', () => {
    const halley = orbitOf(comets.find((c) => c.id === 'halley'));
    expect(distance(halley.positionAt(daysSinceJ2000('1986-02-09'), vector()))).toBeCloseTo(0.586, 2);
    expect(distance(halley.positionAt(daysSinceJ2000('2061-07-28'), vector()))).toBeCloseTo(0.586, 2);
  });

  it('solver gak pernah menghasilkan NaN, termasuk hari negatif', () => {
    for (const body of [...planets, ...dwarfPlanets, ...comets]) {
      const orbit = orbitOf(body);
      for (let day = -40_000; day < 40_000; day += 997) {
        const r = distance(orbit.positionAt(day, vector()));
        expect(Number.isFinite(r)).toBe(true);
        const { eccentricity } = body.orbit;
        expect(r).toBeGreaterThanOrEqual(body.distance * (1 - eccentricity) - 1e-9);
        expect(r).toBeLessThanOrEqual(body.distance * (1 + eccentricity) + 1e-9);
      }
    }
  });
});

describe('mode skala', () => {
  it('unscaleDistance kebalikan scaleDistance di dua mode', () => {
    for (const au of [0.39, 1, 5.2, 30, 97]) {
      expect(unscaleDistance(scaleDistance(au))).toBeCloseTo(au, 9);
      expect(unscaleDistance(scaleDistance(au, 'real'), 'real')).toBeCloseTo(au, 9);
    }
  });

  it('blendScale geometris dan tepat di ujungnya', () => {
    expect(blendScale(2, 200, 0)).toBe(2);
    expect(blendScale(2, 200, 1)).toBeCloseTo(200, 9);
    expect(blendScale(2, 200, 0.5)).toBeCloseTo(20, 9);
  });

  it('di mode nyata Bumi sekitar 0,017 unit dan 1 AU = 400 unit', () => {
    expect(scaleRadius(1, 'real')).toBeCloseTo(0.017, 3);
    expect(scaleDistance(1, 'real')).toBe(400);
  });
});

describe('Apophis', () => {
  const apophis = asteroids.find((a) => a.id === 'apophis');
  const earth = orbitOf(planets.find((p) => p.id === 'earth'));
  const orbit = orbitOf(apophis);
  const km = (days) => {
    const a = orbit.positionAt(days, vector());
    const b = earth.positionAt(days, vector());
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 149_597_870.7;
  };

  it('lewat sekitar 38 ribu km dari Bumi tanggal 13 April 2029, sekitar jam 22 UTC', () => {
    const moment = (Date.parse(apophis.closeApproach.time) - J2000) / 86_400_000;
    let closest = { km: Infinity, hours: 0 };
    for (let minutes = -24 * 60; minutes <= 24 * 60; minutes += 5) {
      const d = km(moment + minutes / 1440);
      if (d < closest.km) closest = { km: d, hours: minutes / 60 };
    }
    expect(closest.km).toBeGreaterThan(30_000);
    expect(closest.km).toBeLessThan(45_000);
    expect(Math.abs(closest.hours)).toBeLessThan(1);
  });

  it('jauh dari Bumi sebulan sebelum dan sesudahnya', () => {
    const moment = (Date.parse(apophis.closeApproach.time) - J2000) / 86_400_000;
    expect(km(moment - 30)).toBeGreaterThan(10_000_000);
    expect(km(moment + 30)).toBeGreaterThan(10_000_000);
  });
});
