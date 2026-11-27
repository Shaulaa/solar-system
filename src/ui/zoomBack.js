import { BACK_BUTTON_AT, createStageTracker } from '../galaxy/zoomLevels.js';
import { t } from '../i18n/index.js';

// Tombol balik ke tampilan awal, di atas toolbar. Satu tombol, dua keadaan:
//   zoom     "Kembali ke Tata Surya", waktu zoomLevel di atas BACK_BUTTON_AT
//   camera   "Atur ulang kamera", waktu kamera overview sudah di-drag / di-zoom / di-pan menjauh dari
//            posisi awalnya (main.js yang menilai, lihat cameraMoved)
// Pakai hysteresis biar gak kedip di batasnya. Muncul / hilangnya lewat class CSS (opacity + visibility),
// jadi tombol yang tersembunyi juga keluar dari urutan Tab dan pembaca layar. Waktu menghilang teksnya
// gak diganti, biar label lama gak sempat berkedip jadi label lain selama memudar

export function createZoomBack({ onClick }) {
  const button = document.getElementById('zoom-back');
  const label = button.querySelector('.zoom-back-label');
  const tracker = createStageTracker([BACK_BUTTON_AT], 0.1);
  let state = null;

  button.addEventListener('click', () => onClick?.());

  return {
    // cameraMoved: kamera overview tata surya sudah jauh dari posisi awalnya
    update(zoomLevel, { enabled = true, cameraMoved = false } = {}) {
      const zoomed = tracker.update(zoomLevel) > 0;
      const next = !enabled ? null : zoomed ? 'zoom' : cameraMoved ? 'camera' : null;
      if (next === state) return;
      state = next;
      if (next) label.textContent = t(next === 'zoom' ? 'zoomBack' : 'resetView');
      button.classList.toggle('is-visible', next !== null);
      // Tombol yang lagi difokus keyboard hilang: fokus jangan nyangkut di elemen tak terlihat
      if (!next && document.activeElement === button) button.blur();
    }
  };
}
