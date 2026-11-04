// Deteksi perangkat mobile sekali di awal
// Dipakai buat nurunin beban GPU (jumlah asteroid, kekuatan bloom).
// Layar sempit ATAU pointer utama kasar (jari) dianggap mobile
export const isMobile =
  window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;
