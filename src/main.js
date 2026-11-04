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
import { createPicker } from './controls/picker.js';
import { createCameraRig, OVERVIEW_POSITION } from './controls/cameraRig.js';
import { createLabels } from './ui/labels.js';
import { createInfoPanel } from './ui/infoPanel.js';
import { isMobile } from './utils/device.js';

// Renderer dan scene
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#010104');

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 60, 140);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 15;
controls.maxDistance = 600;
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
scene.add(orbits);

// Bima Sakti di paling belakang, bintang kelap kelip di depannya
const milkyWay = createMilkyWay();
scene.add(milkyWay.mesh);

const stars = createStars();
scene.add(stars.points);

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
labels.setSize(window.innerWidth, window.innerHeight);

const infoPanel = createInfoPanel({
  onBack: goOverview,
  onPrev: () => stepFocus(-1),
  onNext: () => stepFocus(1)
});

const picker = createPicker({
  camera,
  domElement: canvas,
  bodies,
  onSelect: focusBody,
  onEmptyClick: goOverview,
  onHoverChange: (id) => labels.setHovered(id)
});

function focusBody(id) {
  const body = bodies.get(id);
  if (!body) return;
  rig.focus(body);
  labels.setFocus(id);
  infoPanel.show(body, { prev: bodies.neighbor(id, -1), next: bodies.neighbor(id, 1) });
  rig.setViewShift(infoPanel.viewShift);
}

function goOverview() {
  // Klik area kosong waktu sudah di overview gak ngapa ngapain
  if (!rig.focusedId) return;
  rig.overview();
  labels.setFocus(null);
  infoPanel.hide();
  rig.setViewShift(0);
}

function stepFocus(direction) {
  if (!rig.focusedId) return;
  focusBody(bodies.neighbor(rig.focusedId, direction).id);
}

// Simulasi waktu
const time = {
  daysPerSecond: 10,
  simDays: 0,
  paused: false
};

const statusEl = document.getElementById('status');
function updateStatus() {
  statusEl.textContent = time.paused ? 'Pause' : `1 detik = ${time.daysPerSecond} hari`;
}

// Shortcut keyboard
// Kalau fokus keyboard lagi di tombol / input, tombol itu yang berhak atas spasi dan panah
const isInteractive = (target) =>
  target instanceof Element && target.closest('button, a, input, textarea, select') !== null;

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (isInteractive(e.target)) return;
    e.preventDefault();
    time.paused = !time.paused;
    updateStatus();
  } else if (e.key === 'Escape') {
    goOverview();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (isInteractive(e.target) && e.target.matches('input, textarea, select')) return;
    stepFocus(e.key === 'ArrowLeft' ? -1 : 1);
  }
});

// Intro, kamera mundur pelan dari deket matahari ke tampilan umum
camera.position.set(0, 6, 26);
gsap.to(camera.position, {
  x: OVERVIEW_POSITION.x,
  y: OVERVIEW_POSITION.y,
  z: OVERVIEW_POSITION.z,
  duration: 4,
  ease: 'power3.inOut'
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

  if (!time.paused) time.simDays += delta * time.daysPerSecond;

  // Urutan ini penting (PRD bagian 8): posisi planet harus final dulu
  // sebelum bulan, kamera, dan yang lain baca posisinya
  sun.update(elapsed);
  planets.update(time.simDays);
  moons.update(time.simDays);
  asteroidBelt.update(time.simDays);
  stars.update(elapsed);

  // Kamera ngikutin benda yang difokus, harus setelah posisi planet / bulan final
  // dan sebelum controls.update(), kalau nggak kamera getar
  rig.update();
  controls.update();

  // Hover dan label dihitung dari posisi kamera yang sudah final frame ini
  picker.update();
  labels.update(camera);

  composer.render();
  labels.render(scene, camera);
  requestAnimationFrame(tick);
}

updateStatus();
tick();

// Biar gampang debug dari console browser
window.solar = { scene, camera, controls, planets, moons, asteroidBelt, bodies, rig, time };
