import { BACK_BUTTON_AT, createStageTracker } from '../galaxy/zoomLevels.js';

// Tombol "Kembali ke Tata Surya", muncul waktu zoomLevel di atas BACK_BUTTON_AT (pakai hysteresis
// biar gak kedip di batasnya). Muncul / hilangnya lewat class CSS (opacity + visibility), jadi
// tombol yang tersembunyi juga keluar dari urutan Tab dan pembaca layar

export function createZoomBack({ onClick }) {
  const button = document.getElementById('zoom-back');
  const tracker = createStageTracker([BACK_BUTTON_AT], 0.1);
  let visible = false;

  button.addEventListener('click', () => onClick?.());

  return {
    update(zoomLevel, { enabled = true } = {}) {
      const next = enabled && tracker.update(zoomLevel) > 0;
      if (next === visible) return;
      visible = next;
      button.classList.toggle('is-visible', next);
      // Tombol yang lagi difokus keyboard hilang: fokus jangan nyangkut di elemen tak terlihat
      if (!next && document.activeElement === button) button.blur();
    }
  };
}
