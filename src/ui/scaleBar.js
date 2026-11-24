import { AU_PER_LIGHT_YEAR } from '../galaxy/zoomLevels.js';
import { t, LOCALE } from '../i18n/index.js';

// Penggaris skala di pojok kiri bawah (PRD-GALAXY bagian 4)
//
// Panjang garis menyesuaikan, angkanya selalu bulat: 1, 2, atau 5 kali pangkat 10. Tiap frame dicari
// angka bulat terbesar yang garisnya masih muat di MAX_WIDTH, jadi panjang garis selalu antara
// 40% dan 100% MAX_WIDTH. Satuan pindah dari AU ke tahun cahaya di 0,1 tahun cahaya (sekitar 6.300 AU),
// karena di atas itu angka AU sudah terlalu panjang dibaca. Format angka Indonesia (titik ribuan)
//
// Skala diukur di kedalaman titik yang dilihat kamera galaksi (galaxy.viewDistance). Sebelum jalur
// kamera galaksi belok, jarak ini sama dengan jarak kamera tata surya ke Matahari dalam AU
// (lihat zoomLevels.js), jadi satu rumus berlaku dari tata surya sampai galaksi utuh

const MAX_WIDTH = { wide: 120, narrow: 96 };
const NARROW_QUERY = window.matchMedia('(max-width: 640px)');
const LIGHT_YEAR_FROM = 0.1;

const formatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 });

// Angka bulat 1, 2, atau 5 kali pangkat 10 terbesar yang <= value
export function niceFloor(value) {
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const mantissa = value / power;
  const step = mantissa >= 5 ? 5 : mantissa >= 2 ? 2 : 1;
  // Dibulatkan biar 0.1 * 3 gak jadi 0.30000000000000004 di label
  return Number((step * power).toPrecision(1));
}

// Panjang terbesar yang muat (dalam AU) -> { value, unit, label, au }
export function pickScale(maxAU) {
  const maxLy = maxAU / AU_PER_LIGHT_YEAR;
  if (maxLy >= LIGHT_YEAR_FROM) {
    const value = niceFloor(maxLy);
    // Dari sejuta ke atas (tahap Grup Lokal di layar portrait) ditulis "x juta" biar gak kepanjangan
    const label =
      value >= 1e6
        ? t('unit.millionLightYears', { value: formatter.format(value / 1e6) })
        : t('unit.lightYears', { value: formatter.format(value) });
    return { value, unit: 'ly', label, au: value * AU_PER_LIGHT_YEAR };
  }
  const value = niceFloor(maxAU);
  return { value, unit: 'au', label: t('unit.au', { value: formatter.format(value) }), au: value };
}

export function createScaleBar() {
  const element = document.getElementById('scale-bar');
  const labelElement = element.querySelector('.scale-bar-label');
  const lineElement = element.querySelector('.scale-bar-line');

  let visible = false;
  let shownLabel = '';
  let shownWidth = -1;

  function setVisible(next) {
    if (next === visible) return;
    visible = next;
    element.classList.toggle('is-visible', next);
  }

  return {
    // auPerPixel = berapa AU satu piksel CSS di kedalaman titik pandang. show = boleh tampil
    update({ auPerPixel, show }) {
      setVisible(show && Number.isFinite(auPerPixel) && auPerPixel > 0);
      if (!visible) return;
      const maxWidth = NARROW_QUERY.matches ? MAX_WIDTH.narrow : MAX_WIDTH.wide;
      const scale = pickScale(maxWidth * auPerPixel);
      // DOM cuma disentuh kalau ada yang berubah (lebar dibulatkan ke 0,5 px)
      const width = Math.round((scale.au / auPerPixel) * 2) / 2;
      if (width !== shownWidth) {
        lineElement.style.width = `${width}px`;
        shownWidth = width;
      }
      if (scale.label !== shownLabel) {
        labelElement.textContent = scale.label;
        shownLabel = scale.label;
      }
    }
  };
}
