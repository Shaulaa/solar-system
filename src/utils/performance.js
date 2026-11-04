// Pantau fps dan turunkan kualitas otomatis kalau perangkatnya keberatan
//
// fps dihitung per detik (jumlah frame dalam 1 detik), bukan per frame, biar satu frame
// yang kebetulan lambat (misal waktu upload tekstur) gak langsung dianggap lemot.
// Kalau rata ratanya di bawah batas selama beberapa detik berturut turut, onDrop dipanggil
// dengan level berikutnya (1, 2, ...). Tiap level cukup dipicu sekali

const LOW_FPS = 40;
const LOW_SECONDS = 3;

export function createPerformanceMonitor({ onDrop, maxLevel = 2 }) {
  let windowStart = null;
  let frames = 0;
  let lowSeconds = 0;
  let level = 0;
  let lastFps = null;

  return {
    // Dipanggil sekali tiap frame, pakai timestamp dari requestAnimationFrame / performance.now
    sample(now) {
      if (level >= maxLevel) return;
      if (windowStart === null) {
        windowStart = now;
        frames = 0;
        return;
      }
      frames++;
      const elapsed = now - windowStart;
      if (elapsed < 1000) return;

      lastFps = (frames * 1000) / elapsed;
      windowStart = now;
      frames = 0;

      lowSeconds = lastFps < LOW_FPS ? lowSeconds + 1 : 0;
      if (lowSeconds >= LOW_SECONDS) {
        lowSeconds = 0;
        level++;
        onDrop(level, lastFps);
      }
    },
    // Mulai hitung dari nol, misal setelah tab aktif lagi (frame pertama setelah jeda pasti lama)
    reset() {
      windowStart = null;
      lowSeconds = 0;
    },
    get fps() {
      return lastFps;
    },
    get level() {
      return level;
    }
  };
}
