import { describe, expect, it } from 'vitest';
import {
  fadeBetween,
  createStageTracker,
  zoomLevelAt,
  zoomLevelToAU,
  galaxyViewFit,
  localGroupViewFit,
  ZOOM_STAGES,
  MAX_ZOOM_LEVEL,
  GALAXY_VIEW_LEVEL,
  STAGES,
  GALAXY_ENLARGE,
  galaxyEnlargeAt
} from '../src/galaxy/zoomLevels.js';
import { scaleDistance } from '../src/utils/scale.js';
import { daysFromStart, simDate } from '../src/utils/time.js';

describe('zoomLevel', () => {
  it('fadeBetween 0 di bawah start, 1 di atas end, naik terus di antaranya', () => {
    expect(fadeBetween(1, 2, 4)).toBe(0);
    expect(fadeBetween(5, 2, 4)).toBe(1);
    let previous = 0;
    for (let z = 2; z <= 4; z += 0.1) {
      const value = fadeBetween(z, 2, 4);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('hysteresis: tahap baru pindah setelah lewat batas plus pita, balik setelah di bawah batas minus pita', () => {
    const tracker = createStageTracker([4], 0.15);
    expect(tracker.update(4.1)).toBe(0);
    expect(tracker.update(4.2)).toBe(1);
    expect(tracker.update(3.9)).toBe(1);
    expect(tracker.update(3.8)).toBe(0);
  });

  it('jarak kamera di dalam orbit Neptunus balik ke AU yang sama', () => {
    for (const au of [0.5, 1, 5.2, 20]) {
      expect(zoomLevelAt({ distance: scaleDistance(au) })).toBeCloseTo(Math.log10(au), 6);
    }
    expect(zoomLevelToAU(2, 1.5)).toBeCloseTo(150, 9);
  });

  it('tahap urut dan zoom maksimal di atas tampilan galaksi', () => {
    const starts = ZOOM_STAGES.slice(1).map((stage) => stage.from);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(MAX_ZOOM_LEVEL).toBeGreaterThan(GALAXY_VIEW_LEVEL);
    expect(STAGES.localGroupView.end).toBeLessThanOrEqual(MAX_ZOOM_LEVEL);
  });

  it('faktor bingkai minimal 1 dan membesar di layar portrait', () => {
    expect(galaxyViewFit(16 / 9, 50)).toBe(1);
    expect(galaxyViewFit(390 / 844, 50)).toBeGreaterThan(1);
    expect(localGroupViewFit(390 / 844, 50, 15_000)).toBeGreaterThan(localGroupViewFit(16 / 9, 50, 15_000));
  });
});

describe('tanggal simulasi', () => {
  it('daysFromStart kebalikan simDate', () => {
    for (const days of [-36_500, -1, 0, 1, 400, 27_000]) {
      const date = simDate(days);
      expect(daysFromStart(date.getFullYear(), date.getMonth() + 1, date.getDate())).toBe(days);
    }
  });
});

describe('pembesaran galaksi di tahap Grup Lokal', () => {
  it('ukuran asli sampai Bima Sakti utuh, penuh GALAXY_ENLARGE di zoom paling jauh', () => {
    expect(galaxyEnlargeAt(9)).toBe(1);
    expect(galaxyEnlargeAt(GALAXY_VIEW_LEVEL)).toBe(1);
    expect(galaxyEnlargeAt(MAX_ZOOM_LEVEL)).toBe(GALAXY_ENLARGE);
    expect(galaxyEnlargeAt(MAX_ZOOM_LEVEL + 1)).toBe(GALAXY_ENLARGE);
  });

  it('faktornya di antara 2 dan 2,5 (Awan Magellan Besar gak menumpuk ke Bima Sakti)', () => {
    expect(GALAXY_ENLARGE).toBeGreaterThanOrEqual(2);
    expect(GALAXY_ENLARGE).toBeLessThanOrEqual(2.5);
  });

  it('naik terus tanpa loncat, jadi zoom masuk balik juga mulus', () => {
    let previous = galaxyEnlargeAt(GALAXY_VIEW_LEVEL);
    for (let level = GALAXY_VIEW_LEVEL + 0.01; level <= MAX_ZOOM_LEVEL + 1e-9; level += 0.01) {
      const value = galaxyEnlargeAt(level);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value - previous).toBeLessThan(0.05);
      previous = value;
    }
  });
});
