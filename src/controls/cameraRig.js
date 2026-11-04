import * as THREE from 'three';
import gsap from 'gsap';

// Kamera terbang ke benda langit dan ngikutin benda itu selama difokus
//
// State
//   overview   kamera bebas, target di (0,0,0)
//   flying     lagi terbang ke benda. Tujuannya ngikutin benda yang terus bergerak
//   focus      sudah sampai. Kamera dan target digeser sebesar pergerakan benda tiap frame
//   returning  lagi balik ke posisi overview
//
// update() WAJIB dipanggil setelah planet dan bulan di-update dan sebelum controls.update()
// (PRD bagian 8). Kalau kebalik, kamera ketinggalan satu frame dari planet dan kelihatan getar

// Posisi kamera overview default. Dipakai juga sama intro di main.js dan arah latar Bima Sakti
export const OVERVIEW_POSITION = new THREE.Vector3(0, 85, 185);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const OVERVIEW_MIN_DISTANCE = 15;

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

  function startTween(nextMode) {
    tween?.kill();
    // Intro di main.js juga nge-tween camera.position, matiin biar gak rebutan
    gsap.killTweensOf(camera.position);
    settleControls();

    startPosition.copy(camera.position);
    startTarget.copy(controls.target);
    progress.t = 0;
    mode = nextMode;
    // Selama terbang user gak boleh ganggu kamera
    controls.enabled = false;

    tween = gsap.to(progress, {
      t: 1,
      duration: FLY_DURATION,
      ease: FLY_EASE
    });
  }

  function focus(nextBody) {
    if (nextBody === body && (mode === 'focus' || mode === 'flying')) return;
    body = nextBody;
    body.getPosition(bodyPosition);
    computeOffset(offset, bodyPosition);
    // minDistance diturunin dari awal, kalau nggak OrbitControls nahan kamera di jarak 15
    controls.minDistance = body.radius * FOCUS_MIN_DISTANCE;
    startTween('flying');
  }

  function overview() {
    if (mode === 'overview' || mode === 'returning') return;
    body = null;
    startTween('returning');
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

    if (mode === 'flying') {
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
      camera.position.lerpVectors(startPosition, OVERVIEW_POSITION, progress.t);
      controls.target.lerpVectors(startTarget, OVERVIEW_TARGET, progress.t);

      if (progress.t >= 1) {
        mode = 'overview';
        // Baru dibalikin setelah sampai. Kalau di awal, kamera yang masih dekat planet langsung loncat
        controls.minDistance = OVERVIEW_MIN_DISTANCE;
        controls.enabled = true;
      }
    }
  }

  return {
    focus,
    overview,
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
