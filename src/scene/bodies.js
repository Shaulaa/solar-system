import { sun as sunData } from '../data/planets.js';

// Daftar semua benda langit yang bisa dipilih: Matahari, 8 planet, dan bulan bulan.
// Picker, label, kamera, dan panel info semuanya baca dari sini,
// jadi aturan "benda apa saja yang interaktif" cuma ditulis sekali.
//
// Bentuk tiap item
//   id, name, data   data mentah dari planets.js
//   kind             'star' | 'planet' | 'dwarf' | 'moon'
//   index            urutan planet dari Matahari (0 = Merkurius), null untuk yang lain
//   visible          false kalau bendanya masih tersembunyi (easter egg Pluto)
//   parentId         id planet induk (khusus bulan)
//   radius           radius SEKARANG dalam unit scene (getter, ikut berubah waktu ganti mode skala)
//   mesh             mesh yang dirender, posisi dunianya = posisi benda
//   getPosition(v)   tulis posisi dunia benda ke v
function makeBody({ source, ...fields }) {
  return {
    ...fields,
    mesh: source.mesh,
    get radius() {
      return source.radius;
    },
    get visible() {
      return source.visible ?? true;
    },
    getPosition(target) {
      return source.mesh.getWorldPosition(target);
    }
  };
}

export function createBodyRegistry({ sun, planets, moons }) {
  const list = [
    makeBody({
      source: sun,
      id: sunData.id,
      name: sunData.name,
      data: sunData,
      kind: 'star',
      index: null,
      parentId: null
    }),
    ...planets.list.map((p, i) =>
      makeBody({
        source: p,
        id: p.data.id,
        name: p.data.name,
        data: p.data,
        kind: p.data.kind ?? 'planet',
        index: p.data.kind ? null : i,
        parentId: null
      })
    ),
    ...moons.list.map((m) =>
      makeBody({
        source: m,
        id: m.data.id,
        name: m.data.name,
        data: m.data,
        kind: 'moon',
        index: null,
        parentId: m.parent.data.id
      })
    )
  ];

  const byId = new Map(list.map((b) => [b.id, b]));

  // Urutan navigasi sebelumnya / berikutnya (juga urutan tur): Matahari lalu Merkurius sampai Neptunus.
  // Bulan gak masuk urutan, kalau lagi fokus ke bulan navigasinya pakai posisi planet induknya.
  // Planet katai (Pluto) juga di luar urutan, dianggap ada setelah Neptunus
  const sequence = list.filter((b) => b.kind === 'star' || b.kind === 'planet');

  function neighbor(id, step) {
    const body = byId.get(id);
    if (!body) return null;
    if (body.kind === 'dwarf') return step > 0 ? sequence[0] : sequence[sequence.length - 1];
    const anchorId = body.kind === 'moon' ? body.parentId : id;
    const i = sequence.findIndex((b) => b.id === anchorId);
    const next = (i + step + sequence.length) % sequence.length;
    return sequence[next];
  }

  return {
    list,
    sequence,
    get: (id) => byId.get(id) ?? null,
    neighbor
  };
}
