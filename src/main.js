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
  fadeBetween,
  STAGES,
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
  onBack: () => (selectedSky ? closeSky() : goOverview()),
  onPrev: () => stepFocus(-1),
  onNext: () => stepFocus(1),
  onSwipeClose: () => (selectedSky ? closeSky() : goOverview())
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
  clearSkySelection();
  rig.focus(body);
  labels.setFocus(id);
  infoPanel.show(body, { prev: bodies.neighbor(id, -1), next: bodies.neighbor(id, 1) });
  rig.setViewShift(infoPanel.viewShift);
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
}

function stepFocus(direction) {
  if (selectedSky) {
    stepSky(direction);
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
const view = { orbits: true, labels: true, speedIndex: 1 };

const toolbar = createToolbar({
  onTogglePlay: () => setPaused(!time.paused),
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

// Perubahan kecepatan di-tween biar planet gak tiba tiba ngebut / ngerem
function setSpeed(index) {
  view.speedIndex = THREE.MathUtils.clamp(index, 0, SPEED_PRESETS.length - 1);
  toolbar.setSpeedIndex(view.speedIndex);
  gsap.to(time, {
    daysPerSecond: SPEED_PRESETS[view.speedIndex].days,
    duration: 0.8,
    ease: 'power2.out',
    overwrite: true
  });
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
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.8, overwrite: true }
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
    narrationStep.textContent = `Tur otomatis \u00b7 ${index + 1} dari ${total}`;
    narrationText.textContent = body.data.narration ?? '';
  };
  if (narration.hidden) {
    update();
    narration.hidden = false;
    gsap.fromTo(narration, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6, overwrite: true });
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
const galaxyEntry = {
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
};

// Grup Lokal: pemberhentian terakhir tur dan hasil pencarian. Memilihnya = zoom keluar paling jauh
const GROUP_ZOOM_SECONDS = 3.5;
const localGroupEntry = {
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
};

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

// Bintang tetangga (G5) dan galaksi Grup Lokal: klik buka panel info, klik ruang kosong nutup panelnya.
// Dua lapisan ini (sky layer) bentuknya sama: list, pick(x, y), interactive, setSelected(id). Picker benda
// tata surya mati selama zoom keluar, dan dua lapisan ini gak pernah bisa diklik bareng (bintang tetangga
// sampai zoomLevel sekitar 7, Grup Lokal mulai sekitar 10,4), jadi gak ada yang rebutan klik
const nearbyStars = galaxy.nearbyStars;
const localGroup = galaxy.localGroup;
const skyLayers = [
  { layer: nearbyStars, kind: 'nearby-star' },
  { layer: localGroup, kind: 'local-galaxy' }
].map(({ layer, kind }) => {
  const sky = { layer, bodies: [] };
  sky.bodies = layer.list.map((item, index) => ({ id: item.id, name: item.name, kind, index, data: item, sky }));
  return sky;
});
const [starSky, groupSky] = skyLayers;
const starBodies = starSky.bodies;
// Bima Sakti di pencarian sudah diwakili galaxyEntry (zoom ke galaksi utuh)
const groupBodies = groupSky.bodies.filter((body) => body.id !== galaxyEntry.id);
let selectedSky = null;
let skyPress = null;
let skyHover = false;

function skyNeighbor(body, step) {
  const list = body.sky.bodies;
  return list[(body.index + step + list.length) % list.length];
}

function selectSky(body) {
  tour.stop();
  if (selectedSky && selectedSky.sky !== body.sky) selectedSky.sky.layer.setSelected(null);
  selectedSky = body;
  body.sky.layer.setSelected(body.id);
  infoPanel.show(body, { prev: skyNeighbor(body, -1), next: skyNeighbor(body, 1) });
  // Framing digeser seperti waktu fokus planet (bottom sheet HP / panel desktop nutupin sebagian layar).
  // Kamera galaksi ikut geseran kamera utama, jadi bintang / galaksinya gak ketutup panel
  rig.setViewShift(infoPanel.viewShift);
}

// Lupakan pilihan tanpa nutup panel (panelnya mau dipakai benda lain)
function clearSkySelection() {
  if (!selectedSky) return;
  selectedSky.sky.layer.setSelected(null);
  selectedSky = null;
}

function closeSky() {
  if (!selectedSky) return;
  clearSkySelection();
  infoPanel.hide();
  rig.setViewShift({ x: 0, y: 0 });
}

function stepSky(direction) {
  selectSky(skyNeighbor(selectedSky, direction));
}

// Lapisan yang sekarang bisa diklik, atau null
const activeSky = () => skyLayers.find((sky) => sky.layer.interactive) ?? null;

function pickSky(x, y) {
  const sky = activeSky();
  const item = sky?.layer.pick(x, y);
  return item ? sky.bodies.find((body) => body.id === item.id) : null;
}

canvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  skyPress = { id: event.pointerId, x: event.clientX, y: event.clientY };
});

canvas.addEventListener('pointerup', (event) => {
  if (!skyPress || event.pointerId !== skyPress.id) return;
  const moved = Math.hypot(event.clientX - skyPress.x, event.clientY - skyPress.y);
  skyPress = null;
  // Sama seperti picker planet: gerak 5 px atau lebih berarti lagi muter kamera, bukan klik
  if (moved >= 5 || phase !== 'ready' || !activeSky()) return;
  const body = pickSky(event.clientX, event.clientY);
  if (body) selectSky(body);
  else closeSky();
});

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  const hover = pickSky(event.clientX, event.clientY) !== null;
  if (hover === skyHover) return;
  skyHover = hover;
  canvas.style.cursor = hover ? 'pointer' : '';
});
canvas.addEventListener('wheel', () => tour.stop(), { passive: true });

// Pencarian. Ngetik "pluto" munculin Pluto yang tadinya tersembunyi (easter egg)
const SECRETS = {
  pluto: () => planets.get('pluto')?.reveal()
};

const search = createSearch({
  items: [...bodies.list, galaxyEntry, localGroupEntry, ...groupBodies, ...starBodies],
  onSelect: selectSearchResult,
  onSecret: (query) => SECRETS[query]?.()
});

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
  return FLY_DURATION;
}

function zoomToGalaxy({ fromTour = false } = {}) {
  if (!canInteract()) return;
  if (!fromTour) tour.stop();
  closeSky();
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
  closeSky();
  if (galaxy.particles.state === 'idle') galaxy.prepare(galaxyParticleCount());
  const fromGalaxy = zoomLevel >= GALAXY_VIEW_LEVEL - 0.5;
  const body = id ? groupSky.bodies.find((item) => item.id === id) : null;
  virtualZoom.animateTo({
    to: () => MAX_ZOOM_LEVEL - solarZoomLevel(),
    duration: fromGalaxy ? GROUP_ZOOM_SECONDS : GALAXY_ZOOM_SECONDS + GROUP_ZOOM_SECONDS,
    delay: leaveFocusForZoom(),
    onComplete: body ? () => selectSky(body) : undefined
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
  virtualZoom.animateTo({
    to: () => galaxy.levelForStar(index, camera, fit, starBox()) - solarZoomLevel(),
    duration: STAR_ZOOM_SECONDS,
    delay: leaveFocusForZoom(),
    onComplete: () => selectSky(starBodies[index])
  });
}

// Tombol "Kembali ke Tata Surya": zoomLevel di-tween balik, kamera tata surya ikut terbang ke
// posisi overview dengan durasi yang sama (dua duanya turun terus, jadi zoomLevel gak bolak balik)
function returnToSolar() {
  if (!canInteract() || !virtualZoom.active) return;
  tour.stop();
  closeSky();
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
      setTimeout(() => precompileZoomOutShaders(warmPendingTextures), SHADER_PRECOMPILE_DELAY);
    }
  });
});

// Klik di mana aja selama intro = skip. Pakai capture biar jalan duluan sebelum handler lain
window.addEventListener(
  'pointerdown',
  () => {
    if (phase === 'intro') rig.skipIntro();
  },
  true
);

// Shortcut keyboard
// Elemen yang lagi difokus keyboard berhak atas tombol yang memang dia pakai:
//   tombol / link   pakai spasi (buat ditekan)
//   slider          pakai panah (buat geser nilai), angka / huruf / spasi tetap boleh jadi shortcut
//   kolom ketik     pakai semua huruf dan angka
const isButtonLike = (target) => target instanceof Element && target.closest('button, a') !== null;
const isSlider = (target) => target instanceof Element && target.matches('input[type="range"]');
const isTypingField = (target) =>
  target instanceof Element &&
  (target.matches('textarea, select, [contenteditable="true"]') ||
    (target.matches('input') && !isSlider(target)));

window.addEventListener('keydown', (e) => {
  if (phase === 'loading') return;
  if (phase === 'intro') {
    // Tombol apa saja = skip intro
    rig.skipIntro();
    return;
  }
  // Dialog Tentang punya keyboard sendiri (Esc nutup, Tab muter di dalam)
  if (about.open) return;

  const key = e.key.toLowerCase();

  // Ctrl+K / Cmd+K buka pencarian. preventDefault biar browser gak fokus ke address bar
  if ((e.ctrlKey || e.metaKey) && key === 'k') {
    e.preventDefault();
    openSearch();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.code === 'Space') {
    if (isButtonLike(e.target) || isTypingField(e.target)) return;
    e.preventDefault();
    setPaused(!time.paused);
  } else if (key === 'escape') {
    if (selectedSky) closeSky();
    else goOverview();
  } else if (key === 'arrowleft' || key === 'arrowright') {
    if (isSlider(e.target) || isTypingField(e.target)) return;
    tour.stop();
    stepFocus(key === 'arrowleft' ? -1 : 1);
  } else if (isTypingField(e.target)) {
    // Huruf dan angka di bawah ini gak boleh nyolong ketikan di kolom isian
  } else if (key >= '1' && key <= String(SPEED_PRESETS.length)) {
    // Kontrol khusus tata surya mati di skala galaksi, shortcut-nya juga
    if (toolbar.solarControlsEnabled) setSpeed(Number(key) - 1);
  } else if (key === 'o') {
    if (toolbar.solarControlsEnabled) setOrbitsVisible(!view.orbits);
  } else if (key === 'l') {
    setLabelsVisible(!view.labels);
  } else if (key === 's') {
    toggleScaleMode();
  } else if (key === 't') {
    toggleTour();
  } else if (key === '/') {
    e.preventDefault();
    openSearch();
  } else if (key === '?') {
    openAbout();
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

// Shader yang baru dipakai waktu zoom keluar (titik bintang Matahari, partikel galaksi, debu,
// lapisan tekstur, penanda "Kamu di sini") dikompilasi duluan setelah intro, lewat compileAsync
// (KHR_parallel_shader_compile, gak ngeblok). Tanpa ini, waktu cache shader GPU masih kosong
// (pengunjung pertama), frame setelah shader baru dipakai macet 33 sampai 67 ms (terukur di 1920x1080).
// Render target composer diaktifkan dulu, karena program three.js ikut ditentukan tone mapping dan
// color space render target. Kalau dikompilasi ke layar, programnya beda dan gak kepakai ulang.
// Satu objek per frame: kerja JavaScript three.js nyusun semua program sekaligus jadi satu long task
// 154 ms di 390x844 dengan CPU 4x lebih lambat (pemanggilan WebGL-nya sendiri gak ada yang di atas 11 ms)
const SHADER_PRECOMPILE_DELAY = 1500;

function precompileZoomOutShaders(onDone) {
  const warmup = galaxy.particles.createWarmupObjects();
  const jobs = [];
  const add = (root, jobCamera, targetScene) =>
    root.traverse((object) => {
      if (object.material) jobs.push([object, jobCamera, targetScene]);
    });
  add(warmup.group, galaxy.camera, galaxy.scene);
  add(galaxy.scene, galaxy.camera, galaxy.scene);
  add(sun.group, camera, scene);

  const tasks = [];
  const next = () => {
    const job = jobs.shift();
    if (!job) {
      Promise.all(tasks).then(warmup.dispose, warmup.dispose);
      onDone?.();
      return;
    }
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(composer.readBuffer);
    tasks.push(renderer.compileAsync(...job));
    renderer.setRenderTarget(previousTarget);
    requestAnimationFrame(next);
  };
  next();
}

// Tekstur yang belum pernah diupload ke GPU dikirim duluan, satu per frame. three.js baru upload
// tekstur waktu bendanya pertama kali digambar, padahal benda di luar layar gak digambar (frustum
// culling). Di HP portrait Neptunus ada di luar layar waktu overview, jadi teksturnya (2048x1024 plus
// mipmap) baru diupload waktu zoom keluar mulai: satu frame 166 ms di 390x844 dengan CPU 4x lebih lambat.
// Hal yang sama kejadian waktu user muter kamera. Tekstur lapisan galaksi gak ikut, diurus sendiri
// per tile (galaxy/galaxyTexture.js)
function warmPendingTextures() {
  const pending = new Set();
  const collect = (value) => {
    if (!value?.isTexture || value.isRenderTargetTexture) return;
    const image = value.image;
    const ready = image instanceof HTMLImageElement ? image.complete && image.naturalWidth > 0 : image instanceof ImageBitmap || image instanceof HTMLCanvasElement;
    if (ready && !renderer.properties.get(value).__webglTexture) pending.add(value);
  };
  scene.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) collect(value);
      if (material.uniforms) for (const uniform of Object.values(material.uniforms)) collect(uniform.value);
    }
  });
  const queue = [...pending];
  const isUploaded = (texture) => Boolean(renderer.properties.get(texture).__webglTexture);
  const step = async () => {
    const texture = queue.shift();
    if (!texture) return;
    if (!isUploaded(texture)) await uploadDecoded(texture);
    requestAnimationFrame(step);
  };
  // Upload HTMLImageElement bikin browser decode gambarnya (WebP) di main thread saat itu juga (terukur 197 ms
  // untuk Neptunus di CPU 4x lebih lambat). createImageBitmap dari elemen <img> ternyata juga decode
  // di main thread (terukur 138 ms), yang benar benar di luar main thread cuma dari Blob. Gambarnya
  // diambil ulang dari cache HTTP, di-decode, lalu bitmap yang sudah jadi tinggal disalin ke GPU.
  // Orientasi bitmap diatur waktu decode (imageOrientation), karena WebGL mengabaikan flipY untuk
  // ImageBitmap. Kalau gagal, upload cara biasa
  async function uploadDecoded(texture) {
    const image = texture.image;
    if (image instanceof HTMLImageElement && image.src && typeof createImageBitmap === 'function') {
      try {
        const response = await fetch(image.src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bitmap = await createImageBitmap(await response.blob(), {
          imageOrientation: texture.flipY ? 'flipY' : 'from-image',
          premultiplyAlpha: texture.premultiplyAlpha ? 'premultiply' : 'none',
          colorSpaceConversion: 'none'
        });
        // Sempat digambar (dan diupload pakai gambar aslinya) selama nunggu decode: bitmap gak dipakai
        if (isUploaded(texture)) {
          bitmap.close();
          return;
        }
        texture.image = bitmap;
        texture.flipY = false;
        texture.needsUpdate = true;
      } catch {
        // Upload pakai gambar asli di bawah
      }
    }
    renderer.initTexture(texture);
  }
  requestAnimationFrame(step);
}

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
  galaxyStatus.textContent = next === 'error' ? 'Galaksi gagal disiapkan' : 'Menyiapkan galaksi';
}

// Kredit ilustrasi galaksi NASA/JPL-Caltech wajib tampil selama lapisan teksturnya kelihatan
const galaxyCredit = document.getElementById('credit-galaxy');
function updateGalaxyCredit() {
  const show = galaxy.texture.visible;
  if (galaxyCredit.hidden === !show) return;
  galaxyCredit.hidden = !show;
}

// Bloom per tahap. Setelan tata surya bikin glow Matahari. Di tahap galaksi inti galaksi dan ribuan
// partikel terang ikut kena, dan pendarnya kelihatan sebagai kotak samar di sekitar bulge.
// Penyebabnya UnrealBloomPass: blur di tiap mip pakai kernel gaussian yang dipotong tepat di
// 1 sigma, jadi sumber yang sangat terang selalu menghasilkan kotak, paling kelihatan di dua mip
// terbesar. Parameter radius cuma menggeser bobot mip, gak bisa mematikannya. Jadi di tahap galaksi
// bobot tiap mip (bloomFactors) diatur langsung: mip besar hampir 0, pendar inti tinggal dari mip
// kecil yang tepinya ketutup inti yang memang sudah jenuh. Kekuatan juga dikurangi biar gak putih semua
const bloomFactors = bloom.compositeMaterial.uniforms.bloomFactors.value;
const BLOOM = {
  solar: {
    strength: bloom.strength,
    radius: bloom.radius,
    threshold: bloom.threshold,
    factors: [...bloomFactors]
  },
  galaxy: { strength: bloom.strength * 0.6, radius: 0, threshold: 1.0, factors: [1, 0.55, 0.18, 0.03, 0] }
};
function updateBloom() {
  const t = fadeBetween(zoomLevel, STAGES.galaxyBloom.start, STAGES.galaxyBloom.end);
  const { lerp } = THREE.MathUtils;
  bloom.strength = lerp(BLOOM.solar.strength, BLOOM.galaxy.strength, t);
  bloom.radius = lerp(BLOOM.solar.radius, BLOOM.galaxy.radius, t);
  bloom.threshold = lerp(BLOOM.solar.threshold, BLOOM.galaxy.threshold, t);
  for (let i = 0; i < bloomFactors.length; i++) {
    bloomFactors[i] = lerp(BLOOM.solar.factors[i], BLOOM.galaxy.factors[i], t);
  }
}

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
  // Zoom keluar / masuk sampai bintang tetangga / galaksi Grup Lokal memudar: panelnya ikut ditutup
  if (selectedSky && !selectedSky.sky.layer.interactive) closeSky();
  updateBloom();

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
