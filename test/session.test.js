import { describe, expect, it } from 'vitest';
import { parseSession } from '../src/app/session.js';

const NOW = Date.UTC(2026, 10, 28, 12);
const valid = {
  savedAt: NOW - 2000,
  moment: Date.UTC(2030, 10, 25, 12),
  paused: true,
  speedIndex: 2,
  reversed: true,
  orbits: false,
  labels: true,
  scale: 'real',
  camera: { position: [0, 85, 185], target: [1, 0, -2] },
  zoomOffset: 1.5
};
const parse = (data) => parseSession(JSON.stringify(data), NOW);

describe('keadaan yang dibawa lewat ganti bahasa', () => {
  it('keadaan yang baru disimpan dipakai apa adanya', () => {
    expect(parse(valid)).toEqual({
      moment: valid.moment,
      paused: true,
      speedIndex: 2,
      reversed: true,
      orbits: false,
      labels: true,
      scale: 'real',
      camera: valid.camera,
      zoomOffset: 1.5
    });
  });

  it('kedaluwarsa, rusak, atau tanpa tanggal simulasi = mulai dari awal', () => {
    expect(parse({ ...valid, savedAt: NOW - 5 * 60_000 })).toBeNull();
    expect(parse({ ...valid, moment: 'besok' })).toBeNull();
    expect(parse({ ...valid, moment: 1e20 })).toBeNull();
    expect(parse({ ...valid, savedAt: undefined })).toBeNull();
    expect(parseSession('{bukan json', NOW)).toBeNull();
    expect(parseSession('null', NOW)).toBeNull();
  });

  it('field yang rusak diganti nilai bawaan, bukan dipakai', () => {
    const result = parse({
      ...valid,
      paused: 'ya',
      speedIndex: 1.5,
      scale: 'galaxy',
      orbits: 0,
      camera: { position: [0, 'x', 1], target: [0, 0, 0] },
      zoomOffset: -3
    });
    expect(result).toMatchObject({ paused: false, speedIndex: null, scale: 'pretty', orbits: true, camera: null, zoomOffset: 0 });
  });
});
