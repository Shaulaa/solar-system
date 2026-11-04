import { sun as sunData } from '../data/planets.js';
import { SUN_RADIUS } from '../utils/scale.js';

// Daftar semua benda langit yang bisa dipilih: Matahari, 8 planet, dan bulan bulan.
// Picker, label, kamera, dan panel info semuanya baca dari sini,
// jadi aturan "benda apa saja yang interaktif" cuma ditulis sekali.
//
// Bentuk tiap item
//   id, name, data   data mentah dari planets.js
//   kind             'star' | 'planet' | 'moon'
//   index            urutan planet dari Matahari (0 = Merkurius), null untuk yang lain
//   parentId         id planet induk (khusus bulan)
//   radius           radius yang sudah di-scale (unit scene)
//   mesh             mesh yang dirender, posisi dunianya = posisi benda
//   labelAnchor      Object3D tempat label nempel. Bukan tiltGroup, biar label tetap tegak
//   getPosition(v)   tulis posisi dunia benda ke v
export function createBodyRegistry({ sun, planets, moons }) {
  const make = (item) => ({
    ...item,
    getPosition(target) {
      return item.mesh.getWorldPosition(target);
    }
  });

  const list = [
    make({
      id: sunData.id,
      name: sunData.name,
      data: sunData,
      kind: 'star',
      index: null,
      parentId: null,
      radius: SUN_RADIUS,
      mesh: sun.mesh,
      labelAnchor: sun.group
    }),
    ...planets.list.map((p, i) =>
      make({
        id: p.data.id,
        name: p.data.name,
        data: p.data,
        kind: 'planet',
        index: i,
        parentId: null,
        radius: p.radius,
        mesh: p.mesh,
        labelAnchor: p.anchor
      })
    ),
    ...moons.list.map((m) =>
      make({
        id: m.data.id,
        name: m.data.name,
        data: m.data,
        kind: 'moon',
        index: null,
        parentId: m.parent.data.id,
        radius: m.radius,
        mesh: m.mesh,
        labelAnchor: m.mesh
      })
    )
  ];

  const byId = new Map(list.map((b) => [b.id, b]));

  // Urutan navigasi sebelumnya / berikutnya: Matahari lalu Merkurius sampai Neptunus.
  // Bulan gak masuk urutan, kalau lagi fokus ke bulan navigasinya pakai posisi planet induknya
  const sequence = list.filter((b) => b.kind !== 'moon');

  function neighbor(id, step) {
    const body = byId.get(id);
    if (!body) return null;
    const anchorId = body.kind === 'moon' ? body.parentId : id;
    const i = sequence.findIndex((b) => b.id === anchorId);
    const next = (i + step + sequence.length) % sequence.length;
    return sequence[next];
  }

  return {
    list,
    get: (id) => byId.get(id) ?? null,
    neighbor
  };
}
