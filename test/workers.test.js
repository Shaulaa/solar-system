import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateGalaxy } from '../src/workers/galaxyWorker.js';
import { generateLocalGroup } from '../src/workers/localGroupWorker.js';
import { localGroup } from '../src/data/localGroup.js';

const fluxOf = (c, from = 0, to = c.count) => {
  let flux = 0;
  for (let i = from; i < to; i++) {
    flux += ((c.color[i * 3] + c.color[i * 3 + 1] + c.color[i * 3 + 2]) / 3) * c.size[i] * c.size[i];
  }
  return flux;
};

describe('partikel Bima Sakti', () => {
  // Sidik jari keluaran worker dengan seed asli. Kalau berubah, bentuk galaksinya berubah: pastikan memang disengaja
  it('keluaran sama persis tiap kali dibuat (sidik jari 120 ribu partikel)', () => {
    const hash = createHash('sha256');
    for (const c of generateGalaxy({ total: 120_000, seed: 20261115 })) {
      hash.update(c.name);
      for (const array of [c.position, c.color, c.size, c.seed]) hash.update(Buffer.from(array.buffer));
    }
    expect(hash.digest('hex')).toBe('b58f081cc947235881e559095ae4fabb77e8d798110189a1adf45c23e97bef11');
  });
});

describe('partikel Grup Lokal', () => {
  const galaxies = localGroup.filter((g) => g.shape).map((g) => ({ id: g.id, shape: g.shape }));
  const dwarfs = [
    { position: [100, 0, 0], radius: 10 },
    { position: [0, 200, 0], radius: 50 }
  ];

  it('kecerahan total tiap galaksi = luminosity x fluks acuan, berapa pun jumlah partikelnya', () => {
    for (const scale of [1, 0.35]) {
      const components = generateLocalGroup({ galaxies, dwarfs, scale, seed: 7, referenceFlux: 1000 });
      for (const galaxy of galaxies) {
        const component = components.find((c) => c.name === galaxy.id);
        expect(fluxOf(component) / (galaxy.shape.luminosity * 1000)).toBeCloseTo(1, 4);
      }
    }
  });

  it('galaksi kerdil digabung jadi satu komponen di posisinya masing masing', () => {
    const components = generateLocalGroup({ galaxies: [], dwarfs, scale: 1, seed: 7, referenceFlux: 1000 });
    expect(components).toHaveLength(1);
    const [c] = components;
    expect(c.name).toBe('dwarfs');
    let nearFirst = 0;
    for (let i = 0; i < c.count; i++) {
      if (Math.hypot(c.position[i * 3] - 100, c.position[i * 3 + 1], c.position[i * 3 + 2]) < 20) nearFirst++;
    }
    expect(nearFirst).toBeGreaterThan(50);
  });

  it('gak ada NaN dan jumlah minimal tetap terpenuhi di skala HP', () => {
    for (const c of generateLocalGroup({ galaxies, scale: 0.05, seed: 3, referenceFlux: 1000 })) {
      expect(c.count).toBeGreaterThanOrEqual(1500);
      expect(c.position.every(Number.isFinite)).toBe(true);
      expect(c.size.every((s) => s > 0)).toBe(true);
    }
  });
});
