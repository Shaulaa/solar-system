// Shortcut keyboard
//
// Elemen yang lagi difokus keyboard berhak atas tombol yang memang dia pakai:
//   tombol / link   pakai spasi (buat ditekan)
//   slider          pakai panah (buat geser nilai), angka / huruf / spasi tetap boleh jadi shortcut
//   kolom ketik     pakai semua huruf dan angka
//
//   getPhase()        'loading' | 'intro' | 'ready'
//   isDialogOpen()    dialog Tentang punya keyboard sendiri (Esc nutup, Tab muter di dalam)
//   speedCount        jumlah preset kecepatan (tombol 1 sampai speedCount)
//   actions           fungsi tiap shortcut, lihat pemetaan di bawah
const isButtonLike = (target) => target instanceof Element && target.closest('button, a') !== null;
const isSlider = (target) => target instanceof Element && target.matches('input[type="range"]');
const isTypingField = (target) =>
  target instanceof Element &&
  (target.matches('textarea, select, [contenteditable="true"]') || (target.matches('input') && !isSlider(target)));

// Huruf ke aksi (setelah filter kolom ketik)
const LETTERS = {
  o: 'toggleOrbits',
  l: 'toggleLabels',
  s: 'toggleScale',
  r: 'toggleReverse',
  d: 'openDate',
  e: 'openEvents',
  t: 'toggleTour',
  c: 'resetView',
  '?': 'openAbout'
};

export function bindKeyboardShortcuts({ getPhase, isDialogOpen, speedCount, actions }) {
  window.addEventListener('keydown', (e) => {
    const phase = getPhase();
    if (phase === 'loading') return;
    if (phase === 'intro') {
      // Tombol apa saja = skip intro
      actions.skipIntro();
      return;
    }
    if (isDialogOpen()) return;

    const key = e.key.toLowerCase();

    // Ctrl+K / Cmd+K buka pencarian. preventDefault biar browser gak fokus ke address bar
    if ((e.ctrlKey || e.metaKey) && key === 'k') {
      e.preventDefault();
      actions.openSearch();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.code === 'Space') {
      if (isButtonLike(e.target) || isTypingField(e.target)) return;
      e.preventDefault();
      actions.togglePause();
    } else if (key === 'escape') {
      actions.escape();
    } else if (key === 'arrowleft' || key === 'arrowright') {
      if (isSlider(e.target) || isTypingField(e.target)) return;
      actions.step(key === 'arrowleft' ? -1 : 1);
    } else if (isTypingField(e.target)) {
      // Huruf dan angka di bawah ini gak boleh nyolong ketikan di kolom isian
    } else if (key >= '1' && key <= String(speedCount)) {
      actions.setSpeed(Number(key) - 1);
    } else if (key === '/') {
      e.preventDefault();
      actions.openSearch();
    } else if (LETTERS[key]) {
      actions[LETTERS[key]]();
    }
  });
}
