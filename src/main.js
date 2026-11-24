import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';

import './style.css';
import { createSun } from './scene/sun.js';
import { createPlanets } from './scene/planets.js';
import { createOrbits } from './scene/orbits.js';
import { createStars } from './scene/stars.js';
import { createMilkyWay } from './scene/milkyWay.js';
import { createMoons } from './scene/moons.js';
import { createAsteroidBelt } from './scene/asteroidBelt.js';
import { createBodyRegistry } from './scene/bodies.js';
import { createSolarFade } from './scene/solarFade.js';
import {
  createScaleMode,
  cameraSettings,
  overviewFit,
  SCALE_TRANSITION_DURATION,
  overviewPositionAt
} from './scene/scaleMode.js';
import { createPicker } from './controls/picker.js';
import { createCameraRig, createVirtualZoom, FLY_DURATION } from './controls/cameraRig.js';
import { createGalaxyScene } from './galaxy/galaxyScene.js';
import {
  zoomLevelAt,
  MAX_ZOOM_LEVEL,
  GALAXY_VIEW_LEVEL,
  GALAXY_GENERATE_AT,
  LOCAL_GROUP_GENERATE_AT,
  SOLAR_CONTROLS_UNTIL,
  AU_PER_GALAXY_UNIT,
  createStageTracker
} from './galaxy/zoomLevels.js';
import { createTour } from './controls/tour.js';
import { createLabels } from './ui/labels.js';
import { createInfoPanel } from './ui/infoPanel.js';
import { createToolbar, SPEED_PRESETS } from './ui/toolbar.js';
import { createLoadingScreen } from './ui/loader.js';
import { createSearch } from './ui/search.js';
import { createScaleBar } from './ui/scaleBar.js';
import { createStageName } from './ui/stageName.js';
import { createZoomBack } from './ui/zoomBack.js';
import { loadingManager } from './utils/loader.js';
import { isMobile } from './utils/device.js';
import { createPerformanceMonitor } from './utils/performance.js';
import { daysFromStart } from './utils/time.js';
import { motion, shift } from './utils/motion.js';
import { warmUpGpu, GPU_WARMUP_DELAY } from './app/gpuWarmup.js';
import { createStageBloom } from './app/stageBloom.js';
import { createDeepLinks } from './app/deepLink.js';
import { createSkySelection } from './app/skySelection.js';
import { bindKeyboardShortcuts } from './app/keyboard.js';
import { t, lang, switchLanguage, applyDocumentText, localize } from './i18n/index.js';
import { entries as entriesEn } from './i18n/content.en.js';

// Teks statis di index.html diganti sesuai bahasa (i18n/index.js) sebelum apa pun tampil
applyDocumentText();

// Loading screen dipasang paling awal, sebelum modul scene mulai memuat tekstur
const loadingScreen = createLoadingScreen({ manager: loadingManager });

// Alur aplikasi: loading -> intro -> ready. Interaksi baru dibuka di ready
let phase = 'loading';

// Renderer dan scene
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
// Pengecekan error shader bawaan three.js manggil getProgramInfoLog di pemakaian pertama tiap program,
// dan itu maksa CPU nunggu kompilasi GPU selesai. compileAsync jadi tetap ngeblok: terukur long task
// 249 ms setelah intro di 390x844 dengan CPU 4x lebih lambat (187 ms di getProgramInfoLog).
// Di produksi dimatikan, di mode dev tetap nyala biar error shader kelihatan
renderer.debug.checkShaderErrors = import.meta.env.DEV;

// Render berlapis: galaxyScene (punya latar hitam) digambar dulu, baru scene tata surya di atasnya.
// Makanya scene tata surya gak punya background, kalau punya galaksinya ketimpa
const scene = new THREE.Scene();
const galaxy = createGalaxyScene({
  renderer,
  pixelRatio: renderer.getPixelRatio(),
  anisotropy: Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
});

// Seberapa jauh kamera overview mundur di layar sempit (1 di layar lebar), lihat scene/scaleMode.js
let fit = overviewFit(window.innerWidth / window.innerHeight);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  cameraSettings('pretty', fit).far
);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = cameraSettings('pretty', fit).minDistance;
controls.maxDistance = cameraSettings('pretty', fit).maxDistance;
controls.enablePan = true;
// Di layar sentuh: satu jari muter, dua jari cubit buat zoom. Pan dua jari-nya dimatikan selama
// cubit (lihat createVirtualZoom di controls/cameraRig.js), biar sudut kamera gak ikut geser
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

// Ambient tipis biar sisi gelap planet gak item pekat banget
scene.add(new THREE.AmbientLight(0x404a66, 0.25));

// Isi tata surya. Semua benda dan orbit ditaruh di satu grup, waktu zoom keluar lewat batas kamera
// grup ini yang mengecil (di sekitar Matahari), kamera tata surya-nya diam
const solarRoot = new THREE.Group();
solarRoot.name = 'solar-system';
scene.add(solarRoot);

const sun = createSun();
solarRoot.add(sun.group);

const planets = createPlanets();
solarRoot.add(planets.group);

// Bulan ditempel ke anchor planet masing masing, jadi gak perlu di-add ke scene lagi
const moons = createMoons(planets.list);

const asteroidBelt = createAsteroidBelt({ mobile: isMobile });
solarRoot.add(asteroidBelt.mesh);

const orbits = createOrbits(planets.list);
solarRoot.add(orbits.group);

// Bima Sakti di paling belakang, bintang kelap kelip di depannya.
// Dua duanya ngikutin posisi kamera (kayak skybox), jadi selalu ada di "tak terhingga"
// walaupun di mode Skala Nyata sistemnya melebar sampai belasan ribu unit
const milkyWay = createMilkyWay();
scene.add(milkyWay.mesh);

// Di HP bintangnya dikurangin biar GPU-nya gak berat
const stars = createStars(isMobile ? 4000 : 9000);
scene.add(stars.points);

// Semua tekstur sudah mulai dimuat di atas. Kalau ternyata gak ada sama sekali, loading langsung selesai
loadingScreen.checkNothingToLoad();

const scaleMode = createScaleMode({ sun, planets, moons, asteroidBelt, orbits });

// Post processing buat glow matahari.
// Dua RenderPass ke buffer yang sama: galaksi dulu, lalu depth dikosongkan dan tata surya
// digambar di atasnya tanpa menghapus warna. Bloom jalan sekali buat gabungan keduanya
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(galaxy.scene, galaxy.camera));
const solarPass = new RenderPass(scene, camera);
solarPass.clear = false;
solarPass.clearDepth = true;
composer.addPass(solarPass);
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  isMobile ? 0.6 : 0.9, // strength
  0.5, // radius
  0.9 // threshold, cuma yang terang banget (matahari) yang nge-glow
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Interaksi: daftar benda, kamera terbang, label, panel info, dan klik / hover
const bodies = createBodyRegistry({ sun, planets, moons });
const rig = createCameraRig({ camera, controls });
const overviewTarget = new THREE.Vector3();
rig.setOverview({ position: overviewPositionAt(0, fit, overviewTarget) });
const labels = createLabels({ bodies });
scene.add(labels.group);
labels.setSize(window.innerWidth, window.innerHeight);

// Zoom keluar lewat batas kamera tata surya (lihat galaxy/zoomLevels.js).
// zoomLevel dihitung ulang tiap frame setelah posisi kamera final
let zoomLevel = 0;
const solarZoomLevel = () =>
  zoomLevelAt({ distance: camera.position.length(), k: scaleMode.k, fit });

const virtualZoom = createVirtualZoom({
  camera,
  controls,
  domElement: canvas,
  // Cuma dari tampilan overview. Waktu fokus, kamera nempel ke planet dan target-nya ikut planet
  isAllowed: () => phase === 'ready' && rig.mode === 'overview' && !scaleMode.transitioning,
  maxOffset: () => MAX_ZOOM_LEVEL - solarZoomLevel()
});

const solarFade = createSolarFade({ sun, planets, asteroidBelt, orbits, labels, stars, milkyWay });

// Panel info dipakai bareng benda tata surya, bintang tetangga (G5), dan galaksi Grup Lokal. Kalau yang
// terbuka bintang / galaksi, tombol Kembali / swipe nutup panelnya dan navigasi pindah di daftarnya sendiri
const infoPanel = createInfoPanel({
  onBack: () => (skySelection.selected ? skySelection.close() : goOverview()),
  onPrev: () => stepFocus(-1),
  onNext: () => stepFocus(1),
  onSwipeClose: () => (skySelection.selected ? skySelection.close() : goOverview()),
  getSimDays: () => time.simDays
});

const picker = createPicker({
  scene,
  camera,
  domElement: canvas,
  bodies,
  onSelect: focusBody,
  onEmptyClick: goOverview,
  onHoverChange: (id) => labels.setHovered(id)
});
picker.setEnabled(false);

// Interaksi dikunci selama loading / intro, dan selama transisi skala (dunianya lagi berubah ukuran)
const canInteract = () => phase === 'ready' && !scaleMode.transitioning;

// fromTour: dipanggil dari tur otomatis. Selain itu berarti user yang milih, jadi tur dihentikan
function focusBody(id, { fromTour = false } = {}) {
  const body = bodies.get(id);
  if (!body || !body.visible || !canInteract()) return;
  if (!fromTour) tour.stop();
  // Dipilih dari pencarian / tur waktu lagi zoom keluar: tata surya dibalikin bareng terbangnya
  virtualZoom.reset();
  skySelection.clear();
  rig.focus(body);
  labels.setFocus(id);
  infoPanel.show(body, { prev: bodies.neighbor(id, -1), next: bodies.neighbor(id, 1) });
  rig.setViewShift(infoPanel.viewShift);
  setLink(id);
}

function clearFocus() {
  labels.setFocus(null);
  infoPanel.hide();
  rig.setViewShift({ x: 0, y: 0 });
}

function goOverview() {
  tour.stop();
  // Klik area kosong waktu sudah di overview gak ngapa ngapain
  if (!rig.focusedId || !canInteract()) return;
  rig.overview();
  clearFocus();
  setLink(null);
}

function stepFocus(direction) {
  if (skySelection.selected) {
    skySelection.step(direction);
    return;
  }
  if (!rig.focusedId) return;
  focusBody(bodies.neighbor(rig.focusedId, direction).id);
}

// Simulasi waktu
const time = {
  daysPerSecond: SPEED_PRESETS[1].days,
  simDays: 0,
  paused: false
};

// State tampilan. Tombol toolbar dan shortcut keyboard dua duanya lewat fungsi di bawah ini,
// jadi tampilan tombol selalu sinkron dengan state aslinya
const view = { orbits: true, labels: true, speedIndex: 1, reversed: false };

const toolbar = createToolbar({
  onTogglePlay: () => setPaused(!time.paused),
  onToggleReverse: () => setReversed(!view.reversed),
  onDateChange: setDate,
  onSpeedChange: setSpeed,
  onToggleOrbits: () => setOrbitsVisible(!view.orbits),
  onToggleLabels: () => setLabelsVisible(!view.labels),
  onToggleScale: toggleScaleMode,
  onToggleTour: toggleTour,
  onSearch: openSearch,
  onAbout: openAbout
});

function setPaused(paused) {
  time.paused = paused;
  toolbar.setPaused(paused);
}

// Perubahan kecepatan di-tween biar planet gak tiba tiba ngebut / ngerem. Waktu mundur = kecepatan
// negatif, jadi pindah arah juga di-tween: planet melambat, berhenti sebentar, lalu balik arah
function setSpeed(index) {
  view.speedIndex = THREE.MathUtils.clamp(index, 0, SPEED_PRESETS.length - 1);
  toolbar.setSpeedIndex(view.speedIndex);
  gsap.to(time, {
    daysPerSecond: SPEED_PRESETS[view.speedIndex].days * (view.reversed ? -1 : 1),
    duration: 0.8,
    ease: 'power2.out',
    overwrite: true
  });
}

function setReversed(reversed) {
  if (!toolbar.solarControlsEnabled) return;
  view.reversed = reversed;
  toolbar.setReversed(reversed);
  setSpeed(view.speedIndex);
}

// Lompat ke tanggal tertentu (pemilih tanggal di toolbar). Posisi semua benda langsung dihitung ulang
// dari tanggal itu, kamera yang lagi fokus ikut pindah bareng bendanya. Panel info yang terbuka
// diisi ulang biar fase Bulan / gerhana berikutnya ikut tanggal baru
function setDate(year, month, date) {
  if (!canInteract() || !toolbar.solarControlsEnabled) return;
  // Jam 12 siang, bukan tengah malam: rata rata paling dekat ke kejadian apa pun di tanggal itu
  time.simDays = daysFromStart(year, month, date) + 0.5;
  const focused = rig.focusedId && bodies.get(rig.focusedId);
  if (focused) infoPanel.show(focused, { prev: bodies.neighbor(focused.id, -1), next: bodies.neighbor(focused.id, 1) });
}

function setOrbitsVisible(visible) {
  view.orbits = visible;
  orbits.group.visible = visible;
  toolbar.setOrbitsVisible(visible);
}

function setLabelsVisible(visible) {
  view.labels = visible;
  labels.setEnabled(visible);
  galaxy.youAreHere.setLabelEnabled(visible);
  galaxy.nearbyStars.setLabelEnabled(visible);
  galaxy.localGroup.setLabelEnabled(visible);
  toolbar.setLabelsVisible(visible);
}

// Mode skala
const scaleNote = document.getElementById('scale-note');

function setScaleNote(show) {
  if (show) {
    scaleNote.hidden = false;
    gsap.fromTo(
      scaleNote,
      { autoAlpha: 0, y: shift(8) },
      { autoAlpha: 1, y: 0, duration: motion(0.6), delay: motion(0.8), overwrite: true }
    );
  } else {
    gsap.to(scaleNote, {
      autoAlpha: 0,
      duration: 0.3,
      overwrite: true,
      onComplete: () => {
        scaleNote.hidden = true;
      }
    });
  }
}

function toggleScaleMode() {
  if (phase !== 'ready' || !toolbar.solarControlsEnabled) return;
  tour.stop();
  const next = scaleMode.mode === 'pretty' ? 'real' : 'pretty';
  const target = cameraSettings(next, fit);

  // Keluar dari fokus (atau dari zoom keluar) dulu, kamera balik ke overview mode tujuan
  // bareng transisi skalanya
  clearFocus();
  virtualZoom.reset();
  setLink(null);

  // Batas jarak dan far plane dilonggarkan dulu ke yang paling besar dari dua mode,
  // kalau nggak OrbitControls nahan kamera di tengah jalan. Baru diketatkan setelah sampai
  const other = cameraSettings(scaleMode.mode, fit);
  controls.maxDistance = Math.max(other.maxDistance, target.maxDistance);
  camera.far = Math.max(other.far, target.far);
  camera.updateProjectionMatrix();

  rig.setOverview({ minDistance: target.minDistance });
  rig.overview({ duration: SCALE_TRANSITION_DURATION, force: true });

  scaleMode.set(next, {
    // Tujuan kamera ikut mundur / maju sebanding ukuran dunia di tiap frame transisi
    onUpdate: (k) => rig.setOverview({ position: overviewPositionAt(k, fit, overviewTarget) }),
    onComplete: () => {
      // Dihitung ulang, siapa tahu layarnya diputar selama transisi
      const settings = cameraSettings(next, fit);
      controls.maxDistance = settings.maxDistance;
      camera.far = settings.far;
      camera.updateProjectionMatrix();
    }
  });

  toolbar.setScaleMode(next);
  setScaleNote(next === 'real');
}

// Tur otomatis
const narration = document.getElementById('narration');
const narrationStep = document.getElementById('narration-step');
const narrationText = document.getElementById('narration-text');

function showNarration(body, index, total) {
  const update = () => {
    narrationStep.textContent = t('tour.step', { n: index + 1, total });
    narrationText.textContent = body.data.narration ?? '';
  };
  if (narration.hidden) {
    update();
    narration.hidden = false;
    gsap.fromTo(narration, { autoAlpha: 0, y: shift(10) }, { autoAlpha: 1, y: 0, duration: motion(0.6), overwrite: true });
  } else {
    // Ganti teks pakai crossfade singkat biar gak kedip
    gsap.to(narration, {
      autoAlpha: 0,
      duration: 0.25,
      overwrite: true,
      onComplete: () => {
        update();
        gsap.to(narration, { autoAlpha: 1, duration: 0.45 });
      }
    });
  }
}

function hideNarration() {
  gsap.to(narration, {
    autoAlpha: 0,
    duration: 0.3,
    overwrite: true,
    onComplete: () => {
      narration.hidden = true;
    }
  });
}

// Galaksi Bima Sakti sebagai "benda" yang bisa dicari dan jadi pemberhentian terakhir tur.
// Memilihnya = zoom keluar sampai galaksi utuh (zoomToGalaxy)
const GALAXY_ZOOM_SECONDS = 4;
const galaxyEntry = localize({
  id: 'milky-way',
  name: 'Bima Sakti',
  kind: 'galaxy',
  index: null,
  data: {
    subtitle: 'Galaksi tempat tata surya berada',
    aliases: ['Galaksi Bima Sakti', 'galaksi', 'Milky Way'],
    narration:
      'Dari sejauh ini Matahari tinggal satu titik di lengan Orion, sekitar 26.000 tahun cahaya dari pusat Bima Sakti. Galaksi kita berisi 100 sampai 400 miliar bintang.'
  },
  // Terbang balik dari Neptunus ke overview, zoom keluar, lalu diam cukup lama buat baca narasinya
  tourSeconds: FLY_DURATION + GALAXY_ZOOM_SECONDS + 7
}, entriesEn['milky-way']);

// Grup Lokal: pemberhentian terakhir tur dan hasil pencarian. Memilihnya = zoom keluar paling jauh
const GROUP_ZOOM_SECONDS = 3.5;
const localGroupEntry = localize({
  id: 'local-group',
  name: 'Grup Lokal',
  kind: 'local-group',
  index: null,
  data: {
    subtitle: 'Kumpulan galaksi tempat Bima Sakti berada',
    aliases: ['Local Group', 'Grup Galaksi Lokal'],
    narration:
      'Bima Sakti cuma satu dari lebih 80 galaksi di Grup Lokal. Tetangga besar terdekatnya, Andromeda, jauhnya 2,5 juta tahun cahaya: cahayanya yang sampai malam ini berangkat waktu manusia purba pertama baru muncul.'
  },
  tourSeconds: GROUP_ZOOM_SECONDS + 7
}, entriesEn['local-group']);

const tour = createTour({
  stops: [...bodies.sequence, galaxyEntry, localGroupEntry],
  onVisit: (stop, index, total) => {
    if (stop.kind === 'galaxy') zoomToGalaxy({ fromTour: true });
    else if (stop.kind === 'local-group') zoomToLocalGroup(null, { fromTour: true });
    else focusBody(stop.id, { fromTour: true });
    showNarration(stop, index, total);
  },
  onFinish: () => {
    hideNarration();
    goOverview();
  },
  onStop: hideNarration,
  onChange: (active) => {
    toolbar.setTourActive(active);
    document.body.classList.toggle('is-touring', active);
  }
});

function toggleTour() {
  if (!canInteract()) return;
  tour.toggle();
}

narration.querySelector('[data-action="stop-tour"]').addEventListener('click', () => tour.stop());

// Tur berhenti kalau user ngambil alih kamera: drag, klik, atau scroll di canvas
canvas.addEventListener('pointerdown', () => tour.stop());

// Bintang tetangga dan galaksi Grup Lokal: klik buka panel info (app/skySelection.js)
const nearbyStars = galaxy.nearbyStars;
const localGroup = galaxy.localGroup;
const skySelection = createSkySelection({
  layers: [
    { layer: nearbyStars, kind: 'nearby-star' },
    { layer: localGroup, kind: 'local-galaxy' }
  ],
  canvas,
  infoPanel,
  rig,
  onSelect: (body) => {
    tour.stop();
    setLink(body.id);
  },
  onClose: () => setLink(null),
  isReady: () => phase === 'ready'
});
const [starSky, groupSky] = skySelection.skies;
const starBodies = starSky.bodies;
// Bima Sakti di pencarian sudah diwakili galaxyEntry (zoom ke galaksi utuh)
const groupBodies = groupSky.bodies.filter((body) => body.id !== galaxyEntry.id);

canvas.addEventListener('wheel', () => tour.stop(), { passive: true });

// Pencarian. Ngetik "pluto" munculin Pluto yang tadinya tersembunyi (easter egg)
const SECRETS = {
  pluto: () => planets.get('pluto')?.reveal()
};

const searchItems = [...bodies.list, galaxyEntry, localGroupEntry, ...groupBodies, ...starBodies];
const search = createSearch({
  items: searchItems,
  onSelect: selectSearchResult,
  onSecret: (query) => SECRETS[query]?.()
});

// Tautan langsung (#saturn, #andromeda, ...), lihat app/deepLink.js
const deepLinks = createDeepLinks({
  targets: searchItems,
  secrets: SECRETS,
  onOpen: selectSearchResult,
  isReady: () => phase === 'ready'
});
const setLink = (id) => deepLinks.set(id);

function selectSearchResult(item) {
  if (item.kind === 'galaxy') zoomToGalaxy();
  else if (item.kind === 'local-group') zoomToLocalGroup();
  else if (item.kind === 'local-galaxy') zoomToLocalGroup(item.id);
  else if (item.kind === 'nearby-star') zoomToStar(item.id);
  else focusBody(item.id);
}

// Zoom ke skala lain lewat tombol, pencarian, atau tur (G6). zoomLevel di-tween lewat offset zoom
// virtual. Kalau kamera lagi fokus ke benda, balik ke overview dulu (zoom virtual cuma jalan dari
// overview), tween-nya mulai setelah terbang selesai dan tujuannya dihitung saat itu juga
const STAR_ZOOM_SECONDS = 3;
const RETURN_SECONDS = 2.5;

function leaveFocusForZoom() {
  if (!rig.focusedId) return 0;
  rig.overview();
  clearFocus();
  return motion(FLY_DURATION);
}

function zoomToGalaxy({ fromTour = false } = {}) {
  if (!canInteract()) return;
  if (!fromTour) tour.stop();
  skySelection.close();
  setLink(galaxyEntry.id);
  // Partikel mulai dibuat sekarang, jangan nunggu zoomLevel lewat GALAXY_GENERATE_AT,
  // biar galaksinya sudah siap waktu tween sampai
  if (galaxy.particles.state === 'idle') galaxy.prepare(galaxyParticleCount());
  virtualZoom.animateTo({
    to: () => GALAXY_VIEW_LEVEL - solarZoomLevel(),
    duration: GALAXY_ZOOM_SECONDS,
    delay: leaveFocusForZoom()
  });
}

// Zoom keluar sampai Grup Lokal utuh. id = galaksi yang panel infonya dibuka setelah sampai (opsional).
// Dari tampilan galaksi utuh (tur) cukup GROUP_ZOOM_SECONDS, dari tata surya ditambah lama zoom ke galaksi
function zoomToLocalGroup(id = null, { fromTour = false } = {}) {
  if (!canInteract()) return;
  if (!fromTour) tour.stop();
  skySelection.close();
  setLink(id ?? localGroupEntry.id);
  if (galaxy.particles.state === 'idle') galaxy.prepare(galaxyParticleCount());
  const fromGalaxy = zoomLevel >= GALAXY_VIEW_LEVEL - 0.5;
  const body = id ? groupSky.bodies.find((item) => item.id === id) : null;
  virtualZoom.animateTo({
    to: () => MAX_ZOOM_LEVEL - solarZoomLevel(),
    duration: fromGalaxy ? GROUP_ZOOM_SECONDS : GALAXY_ZOOM_SECONDS + GROUP_ZOOM_SECONDS,
    delay: leaveFocusForZoom(),
    onComplete: body ? () => skySelection.select(body) : undefined
  });
}

// Bagian layar yang aman dari panel info, dalam NDC SEBELUM framing digeser (rig.setViewShift).
//   HP       bottom sheet nutupin sekitar 55% bawah, framing naik 0,2 tinggi layar. Area kelihatan
//            (y 80 sampai 340 px di 390x844, di bawah HUD dan di atas tepi sheet) = y NDC -0,2 sampai 0,4
//   desktop  panel nutupin kanan, framing geser kiri setengah lebar panel, jadi kotaknya simetris
const BOTTOM_SHEET_QUERY = window.matchMedia('(max-width: 767px)');
const starBox = () =>
  BOTTOM_SHEET_QUERY.matches
    ? { xMin: -0.8, xMax: 0.8, yMin: -0.2, yMax: 0.4 }
    : { xMin: -0.6, xMax: 0.6, yMin: -0.8, yMax: 0.8 };

// Zoom ke tahap bintang tetangga sampai bintangnya masuk layar, lalu panel infonya dibuka
function zoomToStar(id) {
  const index = starBodies.findIndex((body) => body.id === id);
  if (index < 0 || !canInteract()) return;
  tour.stop();
  setLink(id);
  virtualZoom.animateTo({
    to: () => galaxy.levelForStar(index, camera, fit, starBox()) - solarZoomLevel(),
    duration: STAR_ZOOM_SECONDS,
    delay: leaveFocusForZoom(),
    onComplete: () => skySelection.select(starBodies[index])
  });
}

// Tombol "Kembali ke Tata Surya": zoomLevel di-tween balik, kamera tata surya ikut terbang ke
// posisi overview dengan durasi yang sama (dua duanya turun terus, jadi zoomLevel gak bolak balik)
function returnToSolar() {
  if (!canInteract() || !virtualZoom.active) return;
  tour.stop();
  skySelection.close();
  setLink(null);
  virtualZoom.animateTo({ to: 0, duration: RETURN_SECONDS });
  rig.overview({ duration: RETURN_SECONDS, force: true });
}

// UI pendukung zoom keluar (G6): penggaris skala, nama tahap, tombol kembali
const scaleBar = createScaleBar();
const stageName = createStageName();
const zoomBack = createZoomBack({ onClick: returnToSolar });
// Kontrol khusus tata surya di toolbar dimatikan di atas SOLAR_CONTROLS_UNTIL (pakai hysteresis)
const solarControlsTracker = createStageTracker([SOLAR_CONTROLS_UNTIL], 0.1);

function updateZoomUi() {
  const ready = phase === 'ready';
  stageName.update(zoomLevel, { enabled: ready });
  zoomBack.update(zoomLevel, { enabled: ready });

  const solarControls = solarControlsTracker.update(zoomLevel) === 0;
  if (solarControls !== toolbar.solarControlsEnabled) {
    toolbar.setSolarControlsEnabled(solarControls);
    // Catatan skala nyata cuma relevan selama tata surya kelihatan
    if (scaleMode.mode === 'real') setScaleNote(solarControls);
  }

  // Skala di kedalaman titik pandang kamera galaksi, dalam AU per piksel CSS.
  // Disembunyikan waktu fokus ke benda. Di mode Enak Dilihat jarak di dalam tata surya dikompres,
  // jadi penggaris baru tampil setelah zoomLevel 2 (di luar itu jarak dihitung linier, lihat zoomLevels.js)
  const viewHeightAU =
    2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * galaxy.viewDistance * AU_PER_GALAXY_UNIT;
  const meaningful = (scaleMode.mode === 'real' && !scaleMode.transitioning) || zoomLevel >= 2;
  scaleBar.update({
    auPerPixel: viewHeightAU / window.innerHeight,
    show: ready && !rig.focusedId && meaningful
  });
}

function openSearch() {
  if (phase !== 'ready') return;
  search.open();
}

// Ganti bahasa (tombol di bawah judul). Halaman dimuat ulang, hash tautan ikut terbawa
for (const button of document.querySelectorAll('#lang-switch, [data-action="switch-language"]')) {
  button.addEventListener('click', () => switchLanguage(lang === 'en' ? 'id' : 'en'));
}

// Petunjuk gestur di bawah judul cukup dibaca sekali: di layar sempit hilang setelah sentuhan pertama
canvas.addEventListener('pointerdown', () => document.body.classList.add('has-interacted'), { once: true });

// Halaman Tentang (dialog bawaan browser)
const about = document.getElementById('about');
about.querySelector('[data-action="close-about"]').addEventListener('click', () => about.close());
// Klik di backdrop (di luar kotak dialog) = tutup
about.addEventListener('click', (event) => {
  const rect = about.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (!inside) about.close();
});

function openAbout() {
  if (phase !== 'ready' || about.open) return;
  about.showModal();
}

// HUD (judul, toolbar, kredit) disembunyikan lewat class is-intro di body sejak HTML dimuat.
// Dilepas waktu intro hampir selesai, transisinya diatur di CSS
const HUD_REVEAL_MS = 1200;

function revealHud() {
  document.body.classList.remove('is-intro');
  setTimeout(() => document.body.classList.add('hud-ready'), HUD_REVEAL_MS);
}

// Kamera nunggu di titik awal intro selama loading, lalu intro jalan setelah overlay hilang
rig.prepareIntro();
loadingScreen.ready.then(() => {
  phase = 'intro';
  rig.playIntro({
    onReveal: revealHud,
    onDone: () => {
      phase = 'ready';
      deepLinks.open();
      setTimeout(() => warmUpGpu({ renderer, composer, galaxy, sun, scene, camera }), GPU_WARMUP_DELAY);
    }
  });
  // Dibuka lewat tautan langsung: intro dilewati biar langsung terbang ke tujuannya
  if (deepLinks.requested) rig.skipIntro();
});

// Klik di mana aja selama intro = skip. Pakai capture biar jalan duluan sebelum handler lain
window.addEventListener(
  'pointerdown',
  () => {
    if (phase === 'intro') rig.skipIntro();
  },
  true
);

// Shortcut keyboard (app/keyboard.js). Kontrol khusus tata surya mati di skala galaksi, shortcut-nya juga
bindKeyboardShortcuts({
  getPhase: () => phase,
  isDialogOpen: () => about.open,
  speedCount: SPEED_PRESETS.length,
  actions: {
    skipIntro: () => rig.skipIntro(),
    openSearch,
    openAbout,
    togglePause: () => setPaused(!time.paused),
    escape: () => (skySelection.selected ? skySelection.close() : goOverview()),
    step: (direction) => {
      tour.stop();
      stepFocus(direction);
    },
    setSpeed: (index) => toolbar.solarControlsEnabled && setSpeed(index),
    toggleOrbits: () => toolbar.solarControlsEnabled && setOrbitsVisible(!view.orbits),
    toggleLabels: () => setLabelsVisible(!view.labels),
    toggleScale: toggleScaleMode,
    toggleReverse: () => setReversed(!view.reversed),
    openDate: () => toolbar.solarControlsEnabled && toolbar.openDatePicker(),
    toggleTour
  }
});

// Layar diputar / di-resize: posisi overview dan batas kamera ikut lebar layar yang baru.
// Kamera gak dipindah paksa (user mungkin lagi ngatur sudutnya sendiri), cuma tujuan
// overview berikutnya dan batasnya yang diganti. Selama transisi skala, onComplete-nya yang ngatur
function updateOverviewFit() {
  const next = overviewFit(camera.aspect);
  if (next === fit) return;
  const levelBefore = zoomLevel;
  fit = next;
  rig.setOverview({ position: overviewPositionAt(scaleMode.k, fit, overviewTarget) });
  if (scaleMode.transitioning) return;
  const settings = cameraSettings(scaleMode.mode, fit);
  controls.maxDistance = settings.maxDistance;
  camera.far = settings.far;
  // Lagi zoom keluar: offset virtual disesuaikan biar zoomLevel tetap. Tanpa ini, layar yang berubah ke
  // portrait (HP diputar, mode perangkat di DevTools, bilah URL HP menyusut) bikin zoomLevel melorot
  // sekitar 0,5 dan galaksi kepotong kiri kanan. Jarak kamera tata surya dibatasi maxDistance yang baru,
  // karena OrbitControls bakal menariknya ke sana di frame berikutnya
  if (virtualZoom.active) {
    const distance = Math.min(camera.position.length(), settings.maxDistance);
    virtualZoom.setOffset(levelBefore - zoomLevelAt({ distance, k: scaleMode.k, fit }));
  }
}

// Resize
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  updateOverviewFit();
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  labels.setSize(w, h);
  // Panel bisa pindah dari samping ke bawah (atau sebaliknya) waktu layar di-resize / diputar
  rig.setViewShift(infoPanel.viewShift);
});

// Performa
// Kalau fps rata rata di bawah 40 selama 3 detik: turunin pixel ratio ke 1,
// dan di HP kalau masih berat, matiin bloom
function setPixelRatio(ratio) {
  renderer.setPixelRatio(ratio);
  composer.setPixelRatio(ratio);
  stars.setPixelRatio(ratio);
  sun.setPixelRatio(ratio);
  galaxy.setPixelRatio(ratio);
}

const performanceMonitor = createPerformanceMonitor({
  maxLevel: 2,
  onDrop: () => {
    if (renderer.getPixelRatio() > 1) setPixelRatio(1);
    else if (isMobile) bloom.enabled = false;
  }
});

// Loop utama
const clock = new THREE.Clock();
let frameId = null;

// Tab gak kelihatan = render berhenti total (hemat baterai), tur ikut di-pause
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frameId);
    frameId = null;
    tour.pause();
  } else if (frameId === null) {
    // Buang delta selama tab disembunyikan, biar planet gak loncat
    clock.getDelta();
    performanceMonitor.reset();
    tour.resume();
    frameId = requestAnimationFrame(tick);
  }
});

// Partikel galaksi dibuat sekali, waktu zoomLevel pertama kali lewat GALAXY_GENERATE_AT.
// Jumlahnya bertingkat: HP 100 ribu, desktop yang sudah diturunkan kualitasnya 200 ribu, desktop 500 ribu
const GALAXY_PARTICLES = { mobile: 100_000, low: 200_000, desktop: 500_000 };
const galaxyStatus = document.getElementById('galaxy-status');
let galaxyStatusState = '';

function galaxyParticleCount() {
  if (isMobile) return GALAXY_PARTICLES.mobile;
  return performanceMonitor.level >= 1 ? GALAXY_PARTICLES.low : GALAXY_PARTICLES.desktop;
}

// Pengali jumlah partikel Grup Lokal (sekitar 100 ribu di desktop), bertingkat seperti Bima Sakti
const LOCAL_GROUP_SCALE = { mobile: 0.35, low: 0.6, desktop: 1 };

function localGroupScale() {
  if (isMobile) return LOCAL_GROUP_SCALE.mobile;
  return performanceMonitor.level >= 1 ? LOCAL_GROUP_SCALE.low : LOCAL_GROUP_SCALE.desktop;
}

function updateGalaxyGeneration() {
  const particles = galaxy.particles;
  if (particles.state === 'idle' && zoomLevel >= GALAXY_GENERATE_AT) {
    galaxy.prepare(galaxyParticleCount());
  }
  // Grup Lokal setelah Bima Sakti selesai (termasuk pemanasan GPU-nya), biar dua worker dan
  // dua upload data gak jatuh di waktu yang sama
  if (particles.state === 'ready' && localGroup.state === 'idle' && zoomLevel >= LOCAL_GROUP_GENERATE_AT) {
    localGroup.generate(localGroupScale());
  }
  // Indikator cuma kalau user sudah di skala galaksi dan datanya belum siap (atau gagal)
  let next = '';
  if (zoomLevel >= GALAXY_GENERATE_AT) {
    if (particles.state === 'generating') next = 'generating';
    else if (particles.state === 'error') next = 'error';
  }
  if (next === galaxyStatusState) return;
  galaxyStatusState = next;
  galaxyStatus.hidden = next === '';
  galaxyStatus.classList.toggle('is-error', next === 'error');
  galaxyStatus.textContent = t(next === 'error' ? 'galaxy.failed' : 'galaxy.preparing');
}

// Kredit ilustrasi galaksi NASA/JPL-Caltech wajib tampil selama lapisan teksturnya kelihatan
const galaxyCredit = document.getElementById('credit-galaxy');
function updateGalaxyCredit() {
  const show = galaxy.texture.visible;
  if (galaxyCredit.hidden === !show) return;
  galaxyCredit.hidden = !show;
}

// Bloom per tahap zoom (app/stageBloom.js)
const stageBloom = createStageBloom(bloom);

// Klik / hover benda cuma jalan setelah intro dan selama tata surya gak lagi dikecilkan
// (planetnya memudar, yang kelihatan cuma titik)
let pickerEnabled = false;
function syncPicker() {
  const enabled = phase === 'ready' && !virtualZoom.active;
  if (enabled === pickerEnabled) return;
  pickerEnabled = enabled;
  picker.setEnabled(enabled);
}

function tick(now) {
  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;

  // Zoom virtual duluan, semua posisi dunia di bawah ini sudah ikut tata surya yang mengecil
  virtualZoom.update(delta);
  const worldScale = Math.pow(10, -virtualZoom.offset);
  solarRoot.scale.setScalar(worldScale);

  // Waktu simulasi baru jalan setelah intro selesai, biar tanggal yang pertama kelihatan
  // di toolbar benar benar tanggal hari ini (intro tetap hidup lewat kamera, matahari, dan bintang)
  if (!time.paused && phase === 'ready') time.simDays += delta * time.daysPerSecond;

  // Urutan ini penting (PRD bagian 8): posisi planet harus final dulu
  // sebelum bulan, kamera, dan yang lain baca posisinya
  sun.update(elapsed);
  planets.update(time.simDays);
  moons.update(time.simDays);
  asteroidBelt.update(time.simDays);
  orbits.update();
  stars.update(elapsed);

  // Kamera ngikutin benda yang difokus, harus setelah posisi planet / bulan final
  // dan sebelum controls.update(), kalau nggak kamera getar
  rig.update();
  controls.update();

  // Latar ikut kamera setelah posisi kamera final frame ini
  stars.points.position.copy(camera.position);
  milkyWay.mesh.position.copy(camera.position);

  // Semua transisi tata surya ke galaksi dihitung dari satu angka ini
  zoomLevel = zoomLevelAt({
    distance: camera.position.length(),
    k: scaleMode.k,
    fit,
    offset: virtualZoom.offset
  });
  solarFade.update(zoomLevel);
  labels.setWorldScale(worldScale);
  galaxy.update(camera, zoomLevel, fit, {
    delta,
    elapsed,
    viewportHeight: renderer.domElement.height,
    cssWidth: window.innerWidth,
    cssHeight: window.innerHeight,
    mainTarget: controls.target
  });
  updateGalaxyGeneration();
  updateGalaxyCredit();
  updateZoomUi();
  skySelection.update();
  stageBloom.update(zoomLevel);

  // Hover, label, dan UI dihitung dari posisi kamera yang sudah final
  syncPicker();
  picker.update();
  labels.update(camera);
  toolbar.setDays(time.simDays);

  composer.render();
  labels.render(scene, camera);

  // Fps cuma dipantau waktu user beneran pakai (bukan pas loading / intro / transisi skala)
  if (phase === 'ready' && !scaleMode.transitioning) performanceMonitor.sample(now);

  frameId = requestAnimationFrame(tick);
}

setPaused(false);
setSpeed(view.speedIndex);
setOrbitsVisible(true);
setLabelsVisible(true);
toolbar.setScaleMode(scaleMode.mode);
toolbar.setTourActive(false);
frameId = requestAnimationFrame(tick);

// Biar gampang debug dari console browser
window.solar = {
  renderer,
  bloom,
  scene,
  camera,
  controls,
  galaxy,
  virtualZoom,
  get zoomLevel() {
    return zoomLevel;
  },
  planets,
  moons,
  asteroidBelt,
  bodies,
  rig,
  scaleMode,
  tour,
  search,
  performanceMonitor,
  time,
  get phase() {
    return phase;
  }
};
