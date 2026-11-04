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
import {
  createScaleMode,
  CAMERA_SETTINGS,
  SCALE_TRANSITION_DURATION,
  overviewPositionAt
} from './scene/scaleMode.js';
import { createPicker } from './controls/picker.js';
import { createCameraRig } from './controls/cameraRig.js';
import { createLabels } from './ui/labels.js';
import { createInfoPanel } from './ui/infoPanel.js';
import { createToolbar, SPEED_PRESETS } from './ui/toolbar.js';
import { createLoadingScreen } from './ui/loader.js';
import { loadingManager } from './utils/loader.js';
import { isMobile } from './utils/device.js';

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

const scene = new THREE.Scene();
scene.background = new THREE.Color('#010104');

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  CAMERA_SETTINGS.pretty.far
);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = CAMERA_SETTINGS.pretty.minDistance;
controls.maxDistance = CAMERA_SETTINGS.pretty.maxDistance;
controls.enablePan = true;

// Ambient tipis biar sisi gelap planet gak item pekat banget
scene.add(new THREE.AmbientLight(0x404a66, 0.25));

// Isi tata surya
const sun = createSun();
scene.add(sun.group);

const planets = createPlanets();
scene.add(planets.group);

// Bulan ditempel ke anchor planet masing masing, jadi gak perlu di-add ke scene lagi
const moons = createMoons(planets.list);

const asteroidBelt = createAsteroidBelt({ mobile: isMobile });
scene.add(asteroidBelt.mesh);

const orbits = createOrbits(planets.list);
scene.add(orbits.group);

// Bima Sakti di paling belakang, bintang kelap kelip di depannya.
// Dua duanya ngikutin posisi kamera (kayak skybox), jadi selalu ada di "tak terhingga"
// walaupun di mode Skala Nyata sistemnya melebar sampai belasan ribu unit
const milkyWay = createMilkyWay();
scene.add(milkyWay.mesh);

const stars = createStars();
scene.add(stars.points);

// Semua tekstur sudah mulai dimuat di atas. Kalau ternyata gak ada sama sekali, loading langsung selesai
loadingScreen.checkNothingToLoad();

const scaleMode = createScaleMode({ sun, planets, moons, asteroidBelt });

// Post processing buat glow matahari
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
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
const labels = createLabels({ bodies });
scene.add(labels.group);
labels.setSize(window.innerWidth, window.innerHeight);

const infoPanel = createInfoPanel({
  onBack: goOverview,
  onPrev: () => stepFocus(-1),
  onNext: () => stepFocus(1)
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

function focusBody(id) {
  const body = bodies.get(id);
  if (!body || !canInteract()) return;
  rig.focus(body);
  labels.setFocus(id);
  infoPanel.show(body, { prev: bodies.neighbor(id, -1), next: bodies.neighbor(id, 1) });
  rig.setViewShift(infoPanel.viewShift);
}

function clearFocus() {
  labels.setFocus(null);
  infoPanel.hide();
  rig.setViewShift(0);
}

function goOverview() {
  // Klik area kosong waktu sudah di overview gak ngapa ngapain
  if (!rig.focusedId || !canInteract()) return;
  rig.overview();
  clearFocus();
}

function stepFocus(direction) {
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
  onToggleScale: toggleScaleMode
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
  toolbar.setLabelsVisible(visible);
}

// Mode skala
const scaleNote = document.getElementById('scale-note');
const overviewTarget = new THREE.Vector3();

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
  if (phase !== 'ready') return;
  const next = scaleMode.mode === 'pretty' ? 'real' : 'pretty';
  const target = CAMERA_SETTINGS[next];

  // Keluar dari fokus dulu, kamera balik ke overview mode tujuan bareng transisi skalanya
  clearFocus();

  // Batas jarak dan far plane dilonggarkan dulu ke yang paling besar dari dua mode,
  // kalau nggak OrbitControls nahan kamera di tengah jalan. Baru diketatkan setelah sampai
  controls.maxDistance = Math.max(
    CAMERA_SETTINGS.pretty.maxDistance,
    CAMERA_SETTINGS.real.maxDistance
  );
  camera.far = Math.max(CAMERA_SETTINGS.pretty.far, CAMERA_SETTINGS.real.far);
  camera.updateProjectionMatrix();

  rig.setOverview({ minDistance: target.minDistance });
  rig.overview({ duration: SCALE_TRANSITION_DURATION, force: true });

  scaleMode.set(next, {
    // Tujuan kamera ikut mundur / maju sebanding ukuran dunia di tiap frame transisi
    onUpdate: (k) => rig.setOverview({ position: overviewPositionAt(k, overviewTarget) }),
    onComplete: () => {
      controls.maxDistance = target.maxDistance;
      camera.far = target.far;
      camera.updateProjectionMatrix();
    }
  });

  toolbar.setScaleMode(next);
  setScaleNote(next === 'real');
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
      picker.setEnabled(true);
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
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key.toLowerCase();

  if (e.code === 'Space') {
    if (isButtonLike(e.target) || isTypingField(e.target)) return;
    e.preventDefault();
    setPaused(!time.paused);
  } else if (key === 'escape') {
    goOverview();
  } else if (key === 'arrowleft' || key === 'arrowright') {
    if (isSlider(e.target) || isTypingField(e.target)) return;
    stepFocus(key === 'arrowleft' ? -1 : 1);
  } else if (isTypingField(e.target)) {
    // Huruf dan angka di bawah ini gak boleh nyolong ketikan di kolom isian
  } else if (key >= '1' && key <= String(SPEED_PRESETS.length)) {
    setSpeed(Number(key) - 1);
  } else if (key === 'o') {
    setOrbitsVisible(!view.orbits);
  } else if (key === 'l') {
    setLabelsVisible(!view.labels);
  } else if (key === 's') {
    toggleScaleMode();
  }
});

// Resize
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  labels.setSize(w, h);
  // Panel bisa pindah dari samping ke bawah (atau sebaliknya) waktu layar di-resize / diputar
  rig.setViewShift(infoPanel.viewShift);
});

// Loop utama
const clock = new THREE.Clock();

function tick() {
  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;

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

  // Hover, label, dan UI dihitung dari posisi kamera yang sudah final
  picker.update();
  labels.update(camera);
  toolbar.setDays(time.simDays);

  composer.render();
  labels.render(scene, camera);
  requestAnimationFrame(tick);
}

setPaused(false);
setSpeed(view.speedIndex);
setOrbitsVisible(true);
setLabelsVisible(true);
toolbar.setScaleMode(scaleMode.mode);
tick();

// Biar gampang debug dari console browser
window.solar = {
  scene,
  camera,
  controls,
  planets,
  moons,
  asteroidBelt,
  bodies,
  rig,
  scaleMode,
  time,
  get phase() {
    return phase;
  }
};
