import { describe, expect, it } from 'vitest';
import { galaxyArtParams } from '../src/galaxy/galaxyArt.js';
import { localGroup } from '../src/data/localGroup.js';

const shapeOf = (id) => localGroup.find((g) => g.id === id).shape;
const DEG = Math.PI / 180;

describe('parameter ilustrasi galaksi dari data shape', () => {
  it('spiral (Andromeda): lengan, pitch, dan ukuran dinormalkan ke jari jari piringan', () => {
    const params = galaxyArtParams(shapeOf('andromeda'));
    expect(params.type).toBe(0);
    expect(params.halfSize).toEqual([760, 760]);
    expect(params.arms).toBe(2);
    expect(params.armTan).toBeCloseTo(Math.tan(8 * DEG), 10);
    expect(params.armStart).toBeCloseTo(110 / 760, 10);
    expect(params.diskScale).toBeCloseTo(175 / 760, 10);
    expect(params.bulge).toBeCloseTo(38 / 760, 10);
  });

  it('tak beraturan (Awan Magellan Besar): bidangnya ikut diregangkan, batang dan nebula di tempat yang sama dengan partikelnya', () => {
    const params = galaxyArtParams(shapeOf('lmc'));
    expect(params.type).toBe(1);
    expect(params.halfSize[0]).toBeCloseTo(110 * 1.1, 10);
    expect(params.halfSize[1]).toBe(110);
    expect(params.stretch).toBe(1.1);
    expect(params.bar).toEqual([-10 / 110, 6 / 110, 32 / 110, 7 / 110]);
    expect(params.nebula).toEqual([26 / 110, -24 / 110]);
  });

  it('stretch kosong dianggap 1, inti selalu lebih kecil dari piringannya', () => {
    const shape = { ...shapeOf('smc'), stretch: undefined };
    expect(galaxyArtParams(shape).stretch).toBe(1);
    for (const galaxy of localGroup.filter((g) => g.shape)) {
      const params = galaxyArtParams(galaxy.shape);
      expect(params.coreRadius).toBeGreaterThan(0);
      expect(params.coreRadius).toBeLessThan(galaxy.shape.radius * 0.5);
    }
  });

  it('bentuk yang belum dikenal ditolak, bukan digambar asal', () => {
    expect(() => galaxyArtParams({ type: 'elliptical', radius: 100 })).toThrow(/elliptical/);
  });
});
