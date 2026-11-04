import * as THREE from 'three';
import gsap from 'gsap';

// Kamera terbang ke benda langit dan ngikutin benda itu selama difokus
//
// State
//   intro      animasi pembuka, kamera mundur dari dekat Matahari sambil berputar 30 derajat
//   overview   kamera bebas, target di (0,0,0)
//   flying     lagi terbang ke benda. Tujuannya ngikutin benda yang terus bergerak
//   focus      sudah sampai. Kamera dan target digeser sebesar pergerakan benda tiap frame
//   returning  lagi balik ke posisi overview (juga dipakai waktu ganti mode skala)
//
// update() WAJIB dipanggil setelah planet dan bulan di-update dan sebelum controls.update()
// (PRD bagian 8). Kalau kebalik, kamera ketinggalan satu frame dari planet dan kelihatan getar

// Posisi kamera overview default (mode Enak Dilihat). Dipakai juga buat arah latar Bima Sakti
// dan sebagai dasar posisi overview mode Skala Nyata (scene/scaleMode.js)
export const OVERVIEW_POSITION = new THREE.Vector3(0, 85, 185);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const OVERVIEW_MIN_DISTANCE = 15;

// Intro: mulai dekat Matahari, lalu mundur ke overview sambil berputar segini
const INTRO_DURATION = 4.5;
const INTRO_START_DISTANCE = 26;
const INTRO_START_POLAR = (77 * Math.PI) / 180; // hampir sejajar bidang orbit
const INTRO_ORBIT = (30 * Math.PI) / 180;
const INTRO_REVEAL_AT = 0.8; // judul dan HUD mulai muncul di 80 persen perjalanan

// Near plane dinamis. Di mode Skala Nyata Bumi radiusnya cuma 0,017 unit, jadi kamera fokus
// jaraknya sekitar 0,1 unit dari planet. Near plane tetap 0,1 bakal motong planetnya.
// Near dibikin sebanding jarak kamera ke target, dibatasi supaya presisi depth tetap aman
const NEAR_RATIO = 0.01;
const NEAR_MIN = 0.0005;
const NEAR_MAX = 0.1;

const FLY_DURATION = 1.8;
const FLY_EASE = 'power3.inOut';
const FOCUS_DISTANCE = 5; // kelipatan radius benda
const FOCUS_MIN_DISTANCE = 1.5; // kelipatan radius, biar zoom gak nembus awan / atmosfer
// Kamera ditaruh di arah matahari ke planet lalu diputar segini (di sumbu Y).
// Kalau gak diputar, kamera ada tepat di belakang planet dan yang kelihatan cuma sisi malam.
// Dengan 120 derajat sebagian besar sisi siang kelihatan, terminator juga masih kebagian
const VIEW_ANGLE = (120 * Math.PI) / 180;
const VIEW_LIFT = 0.35; // sedikit dari atas
// Layar portrait (HP) sudut pandang horizontalnya sempit, di 5x radius planet bakal mentok
// kiri kanan layar. Di bawah rasio ini jarak fokus ditambah supaya planet tetap muat
const PORTRAIT_FIT = 0.75;
const VIEW_SHIFT_DURATION = 0.7;

const UP = new THREE.Vector3(0, 1, 0);

const blendDistance = (from, to, t) => from * Math.pow(to / from, t);

export function createCameraRig({ camera, controls }) {
  let mode = 'overview';
  let body = null;
  let tween = null;
  const progress = { t: 0 };

  const startPosition = new THREE.Vector3();
  const startTarget = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const bodyPosition = new THREE.Vector3();
  const lastBodyPosition = new THREE.Vector3();
  const destination = new THREE.Vector3();

  // Overview bisa berubah (mode skala), jadi disimpan di sini dan bisa diganti dari luar
  const overviewPosition = OVERVIEW_POSITION.clone();
  let overviewMinDistance = OVERVIEW_MIN_DISTANCE;

  // Intro
  const introStart = new THREE.Spherical();
  const introEnd = new THREE.Spherical();
  const introSpherical = new THREE.Spherical();
  let introCallbacks = null;
  let introRevealed = false;

  // Geser framing ke atas (fraksi tinggi layar), dipakai waktu bottom sheet nutup bagian bawah
  const view = { shift: 0 };
  let appliedView = '';

  // Selesaikan sisa inertia damping OrbitControls sekarang juga.
  // Kalau nggak, sisa putaran dari drag terakhir bakal ikut nyampur ke animasi terbang
  function settleControls() {
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
  }

  function computeOffset(target, position) {
    const horizontal = new THREE.Vector3(position.x, 0, position.z);
    if (horizontal.lengthSq() < 1e-6) {
      // Matahari ada di pusat, gak punya arah matahari ke benda.
      // Pakai arah kamera sekarang aja biar terbangnya lurus ke depan
      target.copy(camera.position).sub(controls.target);
      target.y = 0;
      if (target.lengthSq() < 1e-6) target.set(0, 0, 1);
      target.normalize();
    } else {
      target.copy(horizontal).normalize().applyAxisAngle(UP, VIEW_ANGLE);
    }
    target.y += VIEW_LIFT;
    const fit = Math.max(1, PORTRAIT_FIT / camera.aspect);
    return target.normalize().multiplyScalar(body.radius * FOCUS_DISTANCE * fit);
  }

  function startTween(nextMode, duration = FLY_DURATION) {
    tween?.kill();
    settleControls();

    startPosition.copy(camera.position);
    startTarget.copy(controls.target);
    progress.t = 0;
    mode = nextMode;
    // Selama terbang user gak boleh ganggu kamera
    controls.enabled = false;

    tween = gsap.to(progress, {
      t: 1,
      duration,
      ease: FLY_EASE
    });
  }

  function focus(nextBody) {
    if (mode === 'intro') return;
    if (nextBody === body && (mode === 'focus' || mode === 'flying')) return;
    body = nextBody;
    body.getPosition(bodyPosition);
    computeOffset(offset, bodyPosition);
    // minDistance diturunin dari awal, kalau nggak OrbitControls nahan kamera di jarak 15
    controls.minDistance = body.radius * FOCUS_MIN_DISTANCE;
    startTween('flying');
  }

  // force: tetap terbang walaupun sudah di overview (dipakai waktu ganti mode skala,
  // karena posisi overview-nya ikut berubah)
  function overview({ duration = FLY_DURATION, force = false } = {}) {
    if (mode === 'intro') return;
    if (!force && (mode === 'overview' || mode === 'returning')) return;
    body = null;
    startTween('returning', duration);
  }

  // Posisi overview tujuan. Boleh dipanggil tiap frame selama transisi skala,
  // mode returning bakal ngejar posisi terbaru (sama kayak flying ngejar planet)
  function setOverview({ position, minDistance }) {
    if (position) overviewPosition.copy(position);
    if (minDistance != null) overviewMinDistance = minDistance;
  }

  // Intro sinematik. onReveal dipanggil waktu kamera hampir sampai (buat fade in judul / HUD),
  // onDone waktu selesai. Selama intro kamera gak bisa digerakkan user
  function playIntro({ onReveal, onDone } = {}) {
    introEnd.setFromVector3(overviewPosition);
    introStart.set(INTRO_START_DISTANCE, INTRO_START_POLAR, introEnd.theta - INTRO_ORBIT);
    introCallbacks = { onReveal, onDone };
    introRevealed = false;

    tween?.kill();
    progress.t = 0;
    mode = 'intro';
    body = null;
    controls.enabled = false;
    controls.target.copy(OVERVIEW_TARGET);
    camera.position.setFromSpherical(introStart);

    tween = gsap.to(progress, { t: 1, duration: INTRO_DURATION, ease: FLY_EASE });
  }

  // Taruh kamera di titik awal intro tanpa jalan (dipakai selama loading screen)
  function prepareIntro() {
    introEnd.setFromVector3(overviewPosition);
    introStart.set(INTRO_START_DISTANCE, INTRO_START_POLAR, introEnd.theta - INTRO_ORBIT);
    controls.enabled = false;
    controls.target.copy(OVERVIEW_TARGET);
    camera.position.setFromSpherical(introStart);
  }

  // Loncat ke akhir intro (klik atau tombol apa saja)
  function skipIntro() {
    if (mode === 'intro') tween?.progress(1);
  }

  function updateIntro() {
    const t = progress.t;
    // Jarak diinterpolasi geometris biar mundurnya kerasa rata dari dekat sampai jauh
    introSpherical.radius = blendDistance(introStart.radius, introEnd.radius, t);
    introSpherical.phi = THREE.MathUtils.lerp(introStart.phi, introEnd.phi, t);
    introSpherical.theta = THREE.MathUtils.lerp(introStart.theta, introEnd.theta, t);
    camera.position.setFromSpherical(introSpherical);
    controls.target.copy(OVERVIEW_TARGET);

    if (!introRevealed && t >= INTRO_REVEAL_AT) {
      introRevealed = true;
      introCallbacks?.onReveal?.();
    }
    if (t >= 1) {
      mode = 'overview';
      controls.minDistance = overviewMinDistance;
      controls.enabled = true;
      const done = introCallbacks?.onDone;
      introCallbacks = null;
      done?.();
    }
  }

  function updateNearPlane() {
    const distance = camera.position.distanceTo(controls.target);
    const near = THREE.MathUtils.clamp(distance * NEAR_RATIO, NEAR_MIN, NEAR_MAX);
    // Cuma update kalau bedanya berarti, updateProjectionMatrix gak perlu tiap frame
    if (Math.abs(near - camera.near) / camera.near > 0.02) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  }

  // setViewOffset geser "jendela" proyeksi tanpa mindahin kamera, jadi orbit, raycast,
  // label, dan bloom tetap konsisten. Cuma dihitung ulang kalau nilai atau ukuran layar berubah
  function applyViewShift() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const key = `${view.shift}|${width}|${height}`;
    if (key === appliedView) return;
    appliedView = key;

    if (view.shift === 0) camera.clearViewOffset();
    else camera.setViewOffset(width, height, 0, view.shift * height, width, height);
  }

  function setViewShift(fraction) {
    gsap.to(view, {
      shift: fraction,
      duration: VIEW_SHIFT_DURATION,
      ease: FLY_EASE,
      overwrite: true
    });
  }

  function update() {
    applyViewShift();

    if (mode === 'intro') {
      updateIntro();
    } else if (mode === 'flying') {
      // Tujuan dihitung ulang tiap frame dari posisi benda SEKARANG,
      // jadi kamera tetap nyampe walaupun planetnya sudah pindah selama 1,8 detik itu
      body.getPosition(bodyPosition);
      destination.copy(bodyPosition).add(offset);
      camera.position.lerpVectors(startPosition, destination, progress.t);
      controls.target.lerpVectors(startTarget, bodyPosition, progress.t);

      // Pindah state di sini (bukan di onComplete GSAP) supaya posisi terakhir yang dipakai
      // buat hitung delta frame depan pasti sama dengan posisi yang barusan dirender.
      // Urutan ticker GSAP vs loop utama jadi gak ngaruh
      if (progress.t >= 1) {
        mode = 'focus';
        lastBodyPosition.copy(bodyPosition);
        controls.enabled = true;
      }
    } else if (mode === 'focus') {
      // Geser kamera dan target sama besar dengan pergerakan benda.
      // Jarak dan sudut kamera ke benda gak berubah, jadi user tetap bisa muter bebas
      body.getPosition(bodyPosition);
      destination.subVectors(bodyPosition, lastBodyPosition);
      camera.position.add(destination);
      controls.target.add(destination);
      lastBodyPosition.copy(bodyPosition);
    } else if (mode === 'returning') {
      camera.position.lerpVectors(startPosition, overviewPosition, progress.t);
      controls.target.lerpVectors(startTarget, OVERVIEW_TARGET, progress.t);

      if (progress.t >= 1) {
        mode = 'overview';
        // Baru dibalikin setelah sampai. Kalau di awal, kamera yang masih dekat planet langsung loncat
        controls.minDistance = overviewMinDistance;
        controls.enabled = true;
      }
    }

    updateNearPlane();
  }

  return {
    focus,
    overview,
    setOverview,
    prepareIntro,
    playIntro,
    skipIntro,
    update,
    setViewShift,
    get mode() {
      return mode;
    },
    get focusedId() {
      return body ? body.id : null;
    }
  };
}
