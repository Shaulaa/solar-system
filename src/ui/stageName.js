import gsap from 'gsap';
import { ZOOM_STAGES, createStageTracker } from '../galaxy/zoomLevels.js';

// Nama tahap skala ("Tata Surya", "Lingkungan Bintang Terdekat", "Galaksi Bima Sakti") yang muncul
// sebentar waktu user masuk tahap baru (PRD-GALAXY bagian 4)
//
// Dua lapis peredam kedip:
//   hysteresis   tahap baru dihitung lewat createStageTracker, jadi zoom bolak balik tepat di batas
//                gak gonta ganti tahap
//   jeda tampil  nama baru ditampilkan setelah tahapnya bertahan SETTLE_SECONDS. Zoom cepat yang
//                cuma lewat (misal dari tata surya langsung ke galaksi) gak sempat memunculkan
//                nama tahap di tengahnya
// Tahap awal (tata surya waktu halaman dibuka) gak diumumkan

const SETTLE_SECONDS = 0.35;
const HOLD_SECONDS = 2.6;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function createStageName() {
  const element = document.getElementById('stage-name');
  const title = element.querySelector('.stage-name-title');
  const note = element.querySelector('.stage-name-note');
  const tracker = createStageTracker(ZOOM_STAGES.slice(1).map((stage) => stage.from));

  let current = 0;
  let shown = 0;
  let pending = null;
  let timeline = null;

  function show(index) {
    shown = index;
    const stage = ZOOM_STAGES[index];
    const rise = reducedMotion.matches ? 0 : 6;
    timeline?.kill();
    timeline = gsap.timeline();
    // Kalau nama sebelumnya masih kelihatan, diganti pakai crossfade singkat
    if (!element.hidden && Number(gsap.getProperty(element, 'opacity')) > 0) {
      timeline.to(element, { autoAlpha: 0, duration: 0.2 });
    }
    timeline
      .call(() => {
        title.textContent = stage.name;
        note.textContent = stage.note;
        element.hidden = false;
      })
      .fromTo(element, { autoAlpha: 0, y: rise }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' })
      .to(element, { autoAlpha: 0, y: -rise, duration: 0.8, ease: 'power2.in' }, `+=${HOLD_SECONDS}`)
      .call(() => {
        element.hidden = true;
      });
  }

  return {
    // enabled = false selama loading / intro: tahap tetap dilacak tapi gak diumumkan
    update(zoomLevel, { enabled = true } = {}) {
      const index = tracker.update(zoomLevel);
      if (index !== current) {
        current = index;
        pending?.kill();
        pending = null;
        if (enabled && index !== shown) pending = gsap.delayedCall(SETTLE_SECONDS, () => show(index));
        else shown = index;
      }
    },
    get stage() {
      return ZOOM_STAGES[current];
    }
  };
}
