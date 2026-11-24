import { afterEach, describe, expect, it, vi } from 'vitest';
import { UI } from '../src/i18n/ui.js';

// i18n/index.js memilih bahasa sekali waktu dimuat, jadi tiap tes bahasa memuat ulang modulnya
async function loadIn(lang) {
  vi.resetModules();
  globalThis.location = new URL(`http://localhost/${lang ? `?lang=${lang}` : ''}`);
  localStorage.clear();
  return {
    i18n: await import('../src/i18n/index.js'),
    data: await import('../src/data/planets.js'),
    stars: await import('../src/data/nearbyStars.js'),
    galaxies: await import('../src/data/localGroup.js')
  };
}

afterEach(() => {
  globalThis.location = new URL('http://localhost/');
  localStorage.clear();
});

describe('kamus antarmuka', () => {
  it('kunci bahasa Indonesia dan Inggris sama persis', () => {
    expect(Object.keys(UI.en).sort()).toEqual(Object.keys(UI.id).sort());
  });

  it('placeholder {nama} di dua bahasa sama', () => {
    const names = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(UI.id)) expect(names(UI.en[key])).toEqual(names(UI.id[key]));
  });
});

describe('pilihan bahasa', () => {
  it('default Indonesia, ?lang=en dipilih dan disimpan', async () => {
    expect((await loadIn()).i18n.lang).toBe('id');
    const { i18n } = await loadIn('en');
    expect(i18n.lang).toBe('en');
    expect(localStorage.getItem('lang')).toBe('en');
  });

  it('t() mengisi parameter dan jatuh ke kunci kalau gak ada', async () => {
    const { i18n } = await loadIn('en');
    expect(i18n.t('tour.step', { n: 2, total: 12 })).toBe('Guided tour · 2 of 12');
    expect(i18n.t('kunci.gak.ada')).toBe('kunci.gak.ada');
  });
});

describe('isi data versi Inggris', () => {
  it('semua planet, bulan, katai, komet, bintang, dan galaksi punya fakta bahasa Inggris', async () => {
    const id = await loadIn();
    const en = await loadIn('en');
    const flatten = (m) => [
      m.data.sun,
      ...[...m.data.planets, ...m.data.dwarfPlanets, ...m.data.comets].flatMap((p) => [p, ...(p.moons ?? [])]),
      ...m.stars.nearbyStars,
      ...m.galaxies.localGroup
    ];
    const before = flatten(id);
    const after = flatten(en);
    expect(after).toHaveLength(before.length);
    after.forEach((body, i) => {
      const original = before[i];
      expect(body.id).toBe(original.id);
      const fact = body.info?.fakta ?? body.fakta;
      expect(fact, `fakta ${body.id}`).toBeTruthy();
      // Fakta khusus wajib diterjemahkan. Fakta umum bintang dibuat ulang dari templat Inggris
      expect(fact, `fakta ${body.id} masih bahasa Indonesia`).not.toBe(original.info?.fakta ?? original.fakta);
    });
  });

  it('nama Indonesia tetap bisa dicari dari versi Inggris', async () => {
    const { data } = await loadIn('en');
    const earth = data.planets.find((p) => p.id === 'earth');
    expect(earth.name).toBe('Earth');
    expect(earth.aliases).toContain('Bumi');
  });
});
