// Loading screen yang nyambung ke LoadingManager bersama (utils/loader.js)
//
// Wajib dibuat SEBELUM modul scene dibuat, karena tekstur mulai dimuat begitu
// createSun / createPlanets dipanggil. Kalau handler dipasang belakangan, progress awalnya kelewat.
// Tekstur yang gagal dimuat tetap dihitung selesai (LoadingManager manggil itemEnd juga
// waktu error), jadi loading gak pernah nyangkut walaupun folder textures kosong
//
// Progress ditulis langsung dari callback LoadingManager, dan semua animasinya (bar dan fade out)
// pakai transisi CSS. Gak ada tween yang nunggu requestAnimationFrame, jadi overlay gak
// ketahan lebih lama dari loading aslinya walaupun main thread lagi sibuk upload tekstur

const MIN_VISIBLE_MS = 800; // biar gak kedip kalau semua tekstur sudah di-cache browser
const FADE_MS = 500; // harus sama dengan transisi .loading di style.css

export function createLoadingScreen({ manager }) {
  const element = document.getElementById('loading');
  const fill = document.getElementById('loading-fill');
  const percent = document.getElementById('loading-percent');

  const shownAt = performance.now();
  let started = false;
  let finished = false;
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  function setProgress(value) {
    fill.style.transform = `scaleX(${value})`;
    percent.textContent = String(Math.round(value * 100));
  }

  function hide() {
    element.classList.add('is-done');
    // Intro langsung jalan bareng overlay yang lagi memudar, gak nunggu fade-nya selesai
    resolveReady();
    // Dibuang dari DOM setelah transisi. setTimeout sebagai cadangan kalau transitionend
    // gak pernah datang (misal tab disembunyikan di tengah fade)
    // (transitionend dari bar progress ikut bubble ke sini, jadi dicek dulu sumbernya)
    const remove = () => element.remove();
    element.addEventListener('transitionend', (event) => {
      if (event.target === element && event.propertyName === 'opacity') remove();
    });
    setTimeout(remove, FADE_MS + 100);
  }

  function finish() {
    if (finished) return;
    finished = true;
    setProgress(1);
    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt));
    setTimeout(hide, wait);
  }

  manager.onStart = () => {
    started = true;
  };
  manager.onProgress = (_url, loaded, total) => {
    started = true;
    setProgress(loaded / total);
  };
  manager.onLoad = finish;

  return {
    // Resolve begitu overlay mulai memudar
    ready,
    // Dipanggil setelah semua modul scene dibuat. Kalau ternyata gak ada yang dimuat sama sekali,
    // onLoad gak akan pernah dipanggil, jadi diselesaikan manual
    checkNothingToLoad() {
      if (!started) finish();
    }
  };
}
