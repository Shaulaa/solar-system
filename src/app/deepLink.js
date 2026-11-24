// Tautan langsung. Alamat halaman ikut benda yang dipilih (#saturn, #andromeda, #milky-way, ...),
// jadi tampilannya bisa dibagikan. Ditulis lewat replaceState biar tombol Back browser gak penuh
// riwayat tiap klik planet. Dibaca sekali setelah intro (main.js memanggil open(), tautan bikin intro
// langsung dilewati) dan tiap kali user ganti hash sendiri (hashchange gak terpicu oleh replaceState)
//
//   targets   daftar benda yang bisa dituju (item pencarian), dicari lewat id
//   secrets   { id: fungsi } benda tersembunyi yang dimunculkan dulu (Pluto)
//   onOpen    dipanggil dengan item tujuan
//   isReady   tautan cuma dibuka setelah intro selesai
export function createDeepLinks({ targets, secrets = {}, onOpen, isReady }) {
  const byId = new Map(targets.map((item) => [item.id, item]));

  function open() {
    const id = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    if (!id || !isReady()) return;
    secrets[id]?.();
    const item = byId.get(id);
    if (item) onOpen(item);
  }

  window.addEventListener('hashchange', open);

  return {
    open,
    // Tulis id ke alamat, atau hapus hash-nya kalau id kosong
    set(id) {
      const hash = id ? `#${encodeURIComponent(id)}` : '';
      if (location.hash === hash) return;
      history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    },
    get requested() {
      return location.hash.length > 1;
    }
  };
}
