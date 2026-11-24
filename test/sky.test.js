import { describe, expect, it } from 'vitest';
import { moonPhase, moonPosition } from '../src/utils/moon.js';
import { skyDirection, diskOrientation } from '../src/utils/sky.js';
import { solarEclipses, lunarEclipses, nextEclipse } from '../src/data/eclipses.js';

const J2000 = Date.UTC(2000, 0, 1, 12);
const daysAt = (utc) => (utc - J2000) / 86_400_000;
const DEG = Math.PI / 180;

// Arah di galaxyScene dari koordinat galaktik (l, b), pemetaan yang sama dengan utils/sky.js
function fromGalactic(l, b) {
  const lr = l * DEG;
  const br = b * DEG;
  return [Math.cos(br) * Math.cos(lr), Math.sin(br), -Math.cos(br) * Math.sin(lr)];
}

describe('koordinat langit', () => {
  it('arah Awan Magellan Besar dan Andromeda sama dengan koordinat galaktik resminya', () => {
    const cases = [
      [skyDirection(5.392917, -69.756), fromGalactic(280.47, -32.89)],
      [skyDirection(0.712306, 41.269), fromGalactic(121.17, -21.57)]
    ];
    for (const [actual, expected] of cases) {
      actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 3));
    }
  });

  it('normal piringan Andromeda miring 77 derajat dari garis pandang', () => {
    const { normal, major } = diskOrientation(0.712306, 41.269, 38, 77);
    const los = skyDirection(0.712306, 41.269);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(Math.acos(Math.abs(dot(normal, los))) / DEG).toBeCloseTo(77, 6);
    expect(dot(major, los)).toBeCloseTo(0, 9);
  });
});

describe('Bulan', () => {
  // Puncak gerhana (UTC). Bulan harus hampir di ekliptika dan fasenya baru / purnama
  const eclipses = [
    { at: Date.UTC(2026, 2, 3, 11, 33), full: true },
    { at: Date.UTC(2026, 7, 12, 17, 46), full: false },
    { at: Date.UTC(2027, 7, 2, 10, 7), full: false },
    { at: Date.UTC(2028, 11, 31, 16, 52), full: true }
  ];

  it('waktu gerhana: lintang Bulan di bawah 1,6 derajat dan fasenya pas', () => {
    for (const { at, full } of eclipses) {
      const d = daysAt(at);
      expect(Math.abs(moonPosition(d).latitude / DEG)).toBeLessThan(1.6);
      const { illumination } = moonPhase(d);
      if (full) expect(illumination).toBeGreaterThan(0.98);
      else expect(illumination).toBeLessThan(0.02);
    }
  });

  it('bulan baru tanpa gerhana: Bulan lewat jauh dari ekliptika', () => {
    const d = daysAt(Date.UTC(2026, 10, 9, 7));
    expect(moonPhase(d).illumination).toBeLessThan(0.02);
    expect(Math.abs(moonPosition(d).latitude / DEG)).toBeGreaterThan(3);
  });

  it('satu siklus fase sekitar 29,5 hari', () => {
    const start = daysAt(Date.UTC(2026, 10, 9, 7));
    const later = moonPhase(start + 29.53).fraction;
    expect(Math.min(later, 1 - later)).toBeLessThan(0.03);
  });
});

describe('daftar gerhana', () => {
  it('urut tanggal', () => {
    for (const list of [solarEclipses, lunarEclipses]) {
      const dates = list.map((e) => e.date);
      expect([...dates].sort()).toEqual(dates);
    }
  });

  it('gerhana berikutnya dan batas rentang', () => {
    expect(nextEclipse(solarEclipses, '2026-11-24').date).toBe('2027-02-06');
    expect(nextEclipse(lunarEclipses, '2026-11-24').date).toBe('2028-01-12');
    expect(nextEclipse(solarEclipses, '2026-08-12').date).toBe('2026-08-12');
    expect(nextEclipse(solarEclipses, '2025-06-01')).toBeNull();
    expect(nextEclipse(solarEclipses, '2031-01-01')).toBeNull();
  });
});
