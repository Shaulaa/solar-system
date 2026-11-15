import gsap from 'gsap';

// Tur otomatis: Matahari lalu Merkurius sampai Neptunus, berhenti sekitar 6 detik di tiap objek,
// lalu ditutup dengan zoom keluar ke galaksi Bima Sakti (main.js)
//
// Dibangun pakai GSAP timeline, jadi gampang di-pause / lanjut (misal waktu tab disembunyikan)
// dan dihentikan kapan saja. Modul ini cuma ngatur urutan dan waktunya. Terbang ke benda,
// panel info, dan narasi tetap lewat fungsi yang sama dengan klik biasa (dioper dari main.js)

const FLY_SECONDS = 1.8; // sama dengan durasi terbang di cameraRig
const STAY_SECONDS = 6;

export function createTour({ stops, onVisit, onFinish, onStop, onChange }) {
  let timeline = null;

  function finish(completed) {
    if (!timeline) return;
    timeline.kill();
    timeline = null;
    onChange?.(false);
    if (completed) onFinish?.();
    else onStop?.();
  }

  function start() {
    if (timeline) return;
    timeline = gsap.timeline({ onComplete: () => finish(true) });

    // Pemberhentian boleh punya lama sendiri (tourSeconds), misal galaksi yang perlu waktu
    // terbang balik ke overview dulu lalu zoom keluar sebelum narasinya bisa dinikmati
    stops.forEach((stop, index) => {
      timeline.call(() => onVisit(stop, index, stops.length));
      timeline.to({}, { duration: stop.tourSeconds ?? FLY_SECONDS + STAY_SECONDS });
    });

    onChange?.(true);
  }

  return {
    start,
    // Dihentikan user (tombol stop, drag, klik, Esc)
    stop: () => finish(false),
    toggle() {
      if (timeline) finish(false);
      else start();
    },
    pause: () => timeline?.pause(),
    resume: () => timeline?.resume(),
    get active() {
      return timeline !== null;
    }
  };
}
