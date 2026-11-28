import { describe, expect, it } from 'vitest';
import { dwarfGalaxies, DWARF_COUNT } from '../src/data/dwarfGalaxies.js';
import { localGroup, localGroupPosition } from '../src/data/localGroup.js';
import { dwarfBrightness } from '../src/galaxy/dwarfGalaxies.js';
import { deepFieldDirections } from '../src/galaxy/deepField.js';
import { skyDirection } from '../src/utils/sky.js';

// Posisi Matahari di grup `galaxy` (galaxy/galaxyScene.js)
const SUN = [-260, 0.65, 0];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const angle = (a, b) => (Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)) * 180) / Math.PI;

describe('galaksi kerdil Grup Lokal', () => {
  const dwarfs = dwarfGalaxies(SUN);
  const andromeda = localGroupPosition(localGroup.find((g) => g.id === 'andromeda'), SUN);

  it('84 galaksi dari katalog, semuanya di dalam Grup Lokal dan datanya lengkap', () => {
    expect(DWARF_COUNT).toBe(84);
    for (const dwarf of dwarfs) {
      expect(distance(dwarf.position, SUN)).toBeLessThan(36_000);
      expect(dwarf.halfLight).toBeGreaterThan(0);
      expect(dwarf.absMag).toBeLessThan(0);
      expect(dwarf.position.every(Number.isFinite)).toBe(true);
    }
  });

  it('membentuk dua kerumunan: satelit Bima Sakti dan satelit Andromeda', () => {
    // Dalam 1 juta tahun cahaya (10.000 unit) dari pusat masing masing
    const nearMilkyWay = dwarfs.filter((d) => distance(d.position, [0, 0, 0]) < 10_000);
    const nearAndromeda = dwarfs.filter((d) => distance(d.position, andromeda) < 10_000);
    expect(nearMilkyWay.length).toBeGreaterThanOrEqual(35);
    expect(nearAndromeda.length).toBeGreaterThanOrEqual(30);
    expect(nearAndromeda.map((d) => d.name)).toContain('M32');
    expect(nearMilkyWay.map((d) => d.name)).toContain('Fornax');
  });

  it('galaksi kerdil tak beraturan yang kaya gas ditandai', () => {
    const gasRich = dwarfs.filter((d) => d.gasRich).map((d) => d.name);
    expect(gasRich).toEqual(expect.arrayContaining(['IC 10', 'IC 1613', 'NGC 6822', 'WLM', 'Leo A']));
    expect(gasRich).not.toContain('Draco');
  });

  it('kecerahan naik dengan magnitudo, tetap kelihatan samar untuk yang paling redup', () => {
    expect(dwarfBrightness(-17)).toBeCloseTo(1, 5);
    expect(dwarfBrightness(-30)).toBeCloseTo(1, 5);
    expect(dwarfBrightness(0)).toBeGreaterThan(0.2);
    expect(dwarfBrightness(-13.5)).toBeGreaterThan(dwarfBrightness(-8.8));
  });
});

describe('latar galaksi jauh', () => {
  const { directions, pole, virgo } = deepFieldDirections(20_000, 5);

  it('arah satuan semua', () => {
    for (const { direction } of directions) expect(direction.length()).toBeCloseTo(1, 5);
  });

  it('memadat di bidang supergalaksi', () => {
    // Kalau rata di bola, bagian yang lintangnya di bawah 15 derajat = sin 15 = 0,26
    const nearPlane = directions.filter(({ direction }) => Math.abs(90 - angle(direction, pole)) < 15).length;
    expect(nearPlane / directions.length).toBeGreaterThan(0.5);
  });

  it('memadat di arah Gugus Virgo', () => {
    // Kalau rata di bola, bagian dalam 10 derajat dari satu titik = (1 - cos 10) / 2 = 0,0076
    const nearVirgo = directions.filter(({ direction }) => angle(direction, virgo) < 10).length;
    expect(nearVirgo / directions.length).toBeGreaterThan(0.05);
  });

  it('Gugus Virgo hampir di bidang supergalaksi (cek konstanta koordinatnya)', () => {
    const v = skyDirection(12.45, 12.72);
    const latitude = 90 - angle({ x: v[0], y: v[1], z: v[2] }, pole);
    expect(Math.abs(latitude)).toBeLessThan(4);
  });

  it('sama persis tiap kali dibuat dengan seed yang sama', () => {
    const again = deepFieldDirections(50, 5).directions;
    expect(again.map((d) => d.direction.x)).toEqual(directions.slice(0, 50).map((d) => d.direction.x));
  });
});
