// Preferensi "kurangi gerakan" dari sistem operasi (prefers-reduced-motion)
//
// Kalau aktif, semua gerakan besar jadi potongan langsung: kamera terbang, zoom ke galaksi / Grup Lokal,
// transisi mode skala, geseran framing panel, dan panel / narasi yang meluncur masuk. Intro sinematik
// dilewati. Animasi kecil yang memang isi pemandangannya (plasma Matahari, ekor komet, bintang kelap
// kelip, galaksi berputar sangat pelan) tetap jalan. Transisi CSS diurus media query di style.css.
// Dibaca tiap kali dipakai, jadi kalau user ganti setelannya di tengah jalan langsung berlaku

const query = window.matchMedia('(prefers-reduced-motion: reduce)');

export function prefersReducedMotion() {
  return query.matches;
}

// Durasi animasi gerak (detik): asli, atau 0 kalau user minta gerakan dikurangi
export function motion(seconds) {
  return query.matches ? 0 : seconds;
}

// Jarak geser elemen UI waktu muncul / hilang (piksel atau persen), 0 kalau gerakan dikurangi
export function shift(amount) {
  return query.matches ? 0 : amount;
}
