// Pilihan benda di skala galaksi: bintang tetangga (G5) dan galaksi Grup Lokal
//
// Klik benda buka panel info, klik ruang kosong nutup panelnya, panah kiri / kanan pindah di daftarnya
// sendiri. Tiap lapisan (layer) bentuknya sama: list, pick(x, y), interactive, setSelected(id).
// Picker benda tata surya mati selama zoom keluar, dan dua lapisan ini gak pernah bisa diklik bareng
// (bintang tetangga sampai zoomLevel sekitar 7, Grup Lokal mulai sekitar 10,4), jadi gak ada yang
// rebutan klik
//
//   layers      [{ layer, kind }]
//   canvas      elemen yang didengar klik dan hover-nya
//   infoPanel   panel info bersama (ui/infoPanel.js)
//   rig         kamera, buat geser framing biar benda gak ketutup panel
//   onSelect    dipanggil dengan benda yang dipilih (main.js: hentikan tur, tulis tautan)
//   onClose     dipanggil waktu pilihan ditutup (main.js: hapus tautan)
//   isReady     klik baru diproses setelah intro
export function createSkySelection({ layers, canvas, infoPanel, rig, onSelect, onClose, isReady }) {
  const skies = layers.map(({ layer, kind }) => {
    const sky = { layer, bodies: [] };
    sky.bodies = layer.list.map((item, index) => ({ id: item.id, name: item.name, kind, index, data: item, sky }));
    return sky;
  });

  let selected = null;
  let press = null;
  let hovering = false;

  const neighbor = (body, step) => {
    const list = body.sky.bodies;
    return list[(body.index + step + list.length) % list.length];
  };

  function select(body) {
    if (selected && selected.sky !== body.sky) selected.sky.layer.setSelected(null);
    selected = body;
    body.sky.layer.setSelected(body.id);
    onSelect?.(body);
    infoPanel.show(body, { prev: neighbor(body, -1), next: neighbor(body, 1) });
    // Framing digeser seperti waktu fokus planet (bottom sheet HP / panel desktop nutupin sebagian layar).
    // Kamera galaksi ikut geseran kamera utama, jadi bintang / galaksinya gak ketutup panel
    rig.setViewShift(infoPanel.viewShift);
  }

  // Lupakan pilihan tanpa nutup panel (panelnya mau dipakai benda lain)
  function clear() {
    if (!selected) return;
    selected.sky.layer.setSelected(null);
    selected = null;
  }

  function close() {
    if (!selected) return;
    clear();
    onClose?.();
    infoPanel.hide();
    rig.setViewShift({ x: 0, y: 0 });
  }

  // Lapisan yang sekarang bisa diklik, atau null
  const active = () => skies.find((sky) => sky.layer.interactive) ?? null;

  function pick(x, y) {
    const sky = active();
    const item = sky?.layer.pick(x, y);
    return item ? sky.bodies.find((body) => body.id === item.id) : null;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });

  canvas.addEventListener('pointerup', (event) => {
    if (!press || event.pointerId !== press.id) return;
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    press = null;
    // Sama seperti picker planet: gerak 5 px atau lebih berarti lagi muter kamera, bukan klik
    if (moved >= 5 || !isReady() || !active()) return;
    const body = pick(event.clientX, event.clientY);
    if (body) select(body);
    else close();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const hover = pick(event.clientX, event.clientY) !== null;
    if (hover === hovering) return;
    hovering = hover;
    canvas.style.cursor = hover ? 'pointer' : '';
  });

  return {
    // Daftar benda per lapisan, urutan sama dengan layers
    skies,
    select,
    clear,
    close,
    step(direction) {
      if (selected) select(neighbor(selected, direction));
    },
    get selected() {
      return selected;
    },
    // Tiap frame: zoom keluar / masuk sampai lapisannya memudar, panelnya ikut ditutup
    update() {
      if (selected && !selected.sky.layer.interactive) close();
    }
  };
}
