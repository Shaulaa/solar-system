import gsap from 'gsap';

// Loading screen yang nyambung ke LoadingManager bersama (utils/loader.js)
//
// Wajib dibuat SEBELUM modul scene dibuat, karena tekstur mulai dimuat begitu
// createSun / createPlanets dipanggil. Kalau handler dipasang belakangan, progress awalnya kelewat.
// Tekstur yang gagal dimuat tetap dihitung selesai (LoadingManager manggil itemEnd juga
// waktu error), jadi loading gak pernah nyangkut walaupun folder textures kosong

const MIN_VISIBLE_MS = 800; // biar gak kedip kalau semua tekstur sudah di-cache browser
const FADE_DURATION = 0.7;

export function createLoadingScreen({ manager }) {
  const element = document.getElementById('loading');
  const fill = document.getElementById('loading-fill');
  const percent = document.getElementById('loading-percent');

  const shownAt = performance.now();
  const shown = { value: 0 };
  let started = false;
  let finished = false;
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  function render() {
    fill.style.transform = `scaleX(${shown.value})`;
    percent.textContent = String(Math.round(shown.value * 100));
  }

  // Angka yang tampil dikejar pelan pelan, biar bar-nya gak loncat loncat
  function animateTo(value, onComplete) {
    gsap.to(shown, {
      value,
      duration: 0.4,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: render,
      onComplete
    });
  }

  function finish() {
    if (finished) return;
    finished = true;

    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt)) / 1000;
    animateTo(1, () => {
      gsap.to(element, {
        autoAlpha: 0,
        duration: FADE_DURATION,
        delay: wait,
        ease: 'power2.inOut',
        onComplete: () => {
          element.remove();
          resolveReady();
        }
      });
    });
  }

  manager.onStart = () => {
    started = true;
  };
  manager.onProgress = (_url, loaded, total) => {
    started = true;
    animateTo(loaded / total);
  };
  manager.onLoad = finish;

  return {
    // Resolve setelah overlay selesai fade out
    ready,
    // Dipanggil setelah semua modul scene dibuat. Kalau ternyata gak ada yang dimuat sama sekali,
    // onLoad gak akan pernah dipanggil, jadi diselesaikan manual
    checkNothingToLoad() {
      if (!started) finish();
    }
  };
}
