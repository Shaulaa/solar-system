// Klik di backdrop (di luar kotak <dialog>) = tutup. Dipakai dialog Tentang, Peristiwa, dan Tanggal
//
// Klik backdrop selalu ber-target elemen dialog itu sendiri, tapi klik di padding kotaknya juga.
// Makanya posisinya dicek terhadap kotak dialog. Tombol di dalam (termasuk yang ditekan lewat keyboard,
// koordinatnya (0, 0)) ber-target tombolnya, jadi gak pernah sampai ke pengecekan posisi
export function closeOnBackdrop(dialog) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });
}
