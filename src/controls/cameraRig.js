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
// Jarak kamera fokus. Minimal 6x radius benda, dan cukup jauh supaya bounding sphere-nya
// (termasuk cincin Saturnus / atmosfer Bumi) cuma ngisi FOCUS_FILL dari setengah area layar
// yang gak ketutup panel info. Di layar portrait (HP) yang sempit itu sisi horizontal,
// jadi kamera otomatis mundur
const FOCUS_DISTANCE = 6; // kelipatan radius benda
const FOCUS_FILL = 0.6;
const FOCUS_MIN_DISTANCE = 1.5; // kelipatan radius, biar zoom gak nembus awan / atmosfer
// Sudut fase: sudut antara arah benda ke kamera dan arah benda ke Matahari (3D).
// 0 berarti kamera tepat di sisi Matahari (planet bulat penuh terang, terminator gak kelihatan),
// 180 berarti di belakang planet (cuma sisi malam). 55 derajat bikin sekitar 4/5 sisi siang
// kelihatan dan terminator tetap ada di tepi
const PHASE_ANGLE = (55 * Math.PI) / 180;
// Kamera agak dari atas, sekitar 31 derajat di atas bidang orbit. Bulan ngorbit di bidang
// ekliptika, jadi dari ketinggian ini bulan yang lewat di depan kelihatan di bawah planet,
// bukan nutupin planetnya. Sudut fase di atas tetap dijaga, sisanya diambil dari putaran horizontal
const VIEW_ELEVATION = Math.atan(0.6);
const VIEW_SHIFT_DURATION = 0.7;

const UP = new THREE.Vector3(0, 1, 0);
const COS_ELEVATION = Math.cos(VIEW_ELEVATION);
const SIN_ELEVATION = Math.sin(VIEW_ELEVATION);

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

  // Geser framing (fraksi lebar / tinggi layar) biar benda yang difokus gak ketutup panel info.
  // x: ke kiri waktu panel nempel di kanan (desktop), y: ke atas waktu bottom sheet (HP)
  const view = { x: 0, y: 0 };
  // Nilai tujuan geseran (view di atas dianimasikan ke sini), dipakai buat ngitung jarak fokus
  const viewTarget = { x: 0, y: 0 };
  let appliedView = '';

  // Selesaikan sisa inertia damping OrbitControls sekarang juga.
  // Kalau nggak, sisa putaran dari drag terakhir bakal ikut nyampur ke animasi terbang
  function settleControls() {
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
  }

  // Jarak kamera ke benda yang difokus, lihat FOCUS_DISTANCE dan FOCUS_FILL
  function focusDistance() {
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Bagian layar yang gak ketutup panel: panel desktop nutup 2x dari lebar,
    // bottom sheet HP kira kira 2y dari tinggi (benda digeser ke tengah sisanya)
    const tanX = tanHalfFov * camera.aspect * (1 - 2 * viewTarget.x);
    const tanY = tanHalfFov * (1 - 2 * viewTarget.y);
    const halfAngle = Math.atan(Math.min(tanX, tanY) * FOCUS_FILL);
    return Math.max(body.radius * FOCUS_DISTANCE, body.boundingRadius / Math.sin(halfAngle));
  }

  const sunward = new THREE.Vector3();
  const side = new THREE.Vector3();

  // Arah kamera dari benda: naik VIEW_ELEVATION dari bidang orbit, dan diputar horizontal
  // dari arah Matahari secukupnya sampai sudut fase 3D-nya pas PHASE_ANGLE.
  // Matahari ada di (0,0,0), jadi arah benda ke Matahari = -posisi benda
  function computeOffset(target, position) {
    sunward.copy(position).negate();
    const horizontalLength = Math.hypot(sunward.x, sunward.z);
    if (horizontalLength < 1e-6) {
      // Matahari sendiri gak punya arah ke Matahari.
      // Pakai arah kamera sekarang aja biar terbangnya lurus ke depan
      target.copy(camera.position).sub(controls.target);
      target.y = 0;
      if (target.lengthSq() < 1e-6) target.set(0, 0, 1);
      target.normalize().multiplyScalar(COS_ELEVATION);
    } else {
      // Planet yang orbitnya miring (Merkurius 7 derajat, Pluto 17) agak di atas / bawah bidang,
      // jadi komponen vertikal arah ke Matahari ikut dihitung:
      // cos(fase) = cos(elevasi) cos(putaran) |horizontal| + sin(elevasi) y
      sunward.normalize();
      const flat = Math.hypot(sunward.x, sunward.z);
      const cosTurn = THREE.MathUtils.clamp(
        (Math.cos(PHASE_ANGLE) - SIN_ELEVATION * sunward.y) / (COS_ELEVATION * flat),
        -1,
        1
      );
      const turn = Math.acos(cosTurn);
      sunward.y = 0;
      sunward.normalize();
      // Diputar ke arah yang sama seperti sebelumnya (searah gerak planet di orbitnya)
      side.crossVectors(UP, sunward);
      target
        .copy(sunward)
        .multiplyScalar(Math.cos(turn))
        .addScaledVector(side, -Math.sin(turn))
        .multiplyScalar(COS_ELEVATION);
    }
    target.y = SIN_ELEVATION;
    return target.normalize().multiplyScalar(focusDistance());
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
    const key = `${view.x}|${view.y}|${width}|${height}`;
    if (key === appliedView) return;
    appliedView = key;

    if (view.x === 0 && view.y === 0) camera.clearViewOffset();
    else camera.setViewOffset(width, height, view.x * width, view.y * height, width, height);
  }

  function setViewShift({ x = 0, y = 0 } = {}) {
    viewTarget.x = x;
    viewTarget.y = y;
    gsap.to(view, {
      x,
      y,
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
      // Arah kamera (relatif ke arah Matahari) juga dihitung ulang tiap frame. Di kecepatan tinggi
      // planet bisa muter beberapa kali selama terbang, kalau offset-nya dikunci dari awal
      // kamera bakal nyampe di sisi malam. Matahari dikecualikan karena arahnya diambil dari kamera
      // Jaraknya juga, karena panel info (yang nentuin area kosong di layar) baru dibuka setelah focus()
      if (body.kind !== 'star') computeOffset(offset, bodyPosition);
      else offset.setLength(focusDistance());
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

// Zoom virtual, lanjutan scroll / pinch setelah kamera tata surya mentok di maxDistance
//
// Kamera tata surya gak pernah mundur lebih jauh dari maxDistance (sekitar 3x orbit Neptunus).
// Scroll keluar setelah mentok gak lagi menggerakkan kamera, tapi nambah offset zoomLevel.
// Offset itu yang bikin isi tata surya mengecil (main.js) dan kamera galaksi mundur
// (galaxy/galaxyScene.js). Kamera tata surya tetap di tempatnya, jadi zoom balik masuk
// otomatis nyampe lagi di posisi kamera terakhir
//
// Selama offset > 0, zoom dan pan OrbitControls dimatikan (scroll masuk harus ngurangin offset dulu,
// dan pan bakal geser pusat mengecilnya). Muter kamera tetap boleh

// Per satu notch scroll (deltaY 100). Di dekat batas pakai langkah zoom OrbitControls
// (0,95 per notch = 0,022 dekade), lalu naik pelan ke 0,08 selama dekade pertama.
// Jadi pindah dari zoom kamera ke zoom virtual gak terasa tiba tiba ngebut
const SOLAR_ZOOM_STEP = -Math.log10(0.95);
const VIRTUAL_ZOOM_STEP = 0.08;
const STEP_RAMP = 1;
// Wheel event bisa datang dengan delta besar (trackpad pinch, mode baris / halaman), dibatasi segini notch
const MAX_NOTCHES = 3;
// Offset dikejar pelan pelan tiap frame (damping eksponensial, gak tergantung fps)
const VIRTUAL_DAMPING = 6;
// Pinch: dekade zoom per dekade perubahan jarak dua jari. 2,5 berarti mencubit sampai setengah jarak
// menambah sekitar 0,75 dekade
const PINCH_GAIN = 2.5;
// Kamera dianggap sudah mentok kalau jaraknya segini dari maxDistance
const LIMIT_RATIO = 0.995;

export function createVirtualZoom({ camera, controls, domElement, isAllowed, maxOffset }) {
  let target = 0;
  let offset = 0;

  // Pointer sentuh yang lagi nempel, buat ngitung jarak pinch
  const touches = new Map();
  let pinchDistance = 0;

  const atLimit = () =>
    camera.position.distanceTo(controls.target) >= controls.maxDistance * LIMIT_RATIO;

  // OrbitControls nyimpan titik awal pinch / pan waktu gesture dimulai. Kalau zoom dan pan-nya
  // dinyalakan lagi di tengah pinch, gerakan pertamanya dihitung dari titik awal yang sudah basi
  // dan kamera loncat. Makanya nyala lagi baru setelah jari dilepas
  function syncControls() {
    const free = target <= 0;
    if (!free) {
      controls.enableZoom = false;
      controls.enablePan = false;
    } else if (touches.size < 2) {
      controls.enableZoom = true;
      controls.enablePan = true;
    }
  }

  function setTarget(value) {
    target = THREE.MathUtils.clamp(value, 0, Math.max(maxOffset(), 0));
    syncControls();
  }

  // amount dalam dekade zoomLevel, positif = keluar. Mulai zoom virtual cuma kalau kamera
  // sudah mentok dan arahnya keluar. Balikin true kalau gerakan ini dipakai zoom virtual
  function apply(amount) {
    if (!isAllowed()) return false;
    if (target <= 0 && !(amount > 0 && atLimit())) return false;
    setTarget(target + amount);
    return true;
  }

  function stepSize() {
    const t = Math.min(target / STEP_RAMP, 1);
    return THREE.MathUtils.lerp(SOLAR_ZOOM_STEP, VIRTUAL_ZOOM_STEP, t * t * (3 - 2 * t));
  }

  // Normalisasi delta disamakan dengan OrbitControls, biar satu notch di dua sistem setara
  function wheelNotches(event) {
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= 100;
    // Pinch di trackpad dikirim browser sebagai wheel + ctrlKey dengan delta kecil
    if (event.ctrlKey) delta *= 10;
    return THREE.MathUtils.clamp(delta / 100, -MAX_NOTCHES, MAX_NOTCHES);
  }

  function handleWheel(event) {
    if (apply(wheelNotches(event) * stepSize())) event.preventDefault();
  }

  const pinchSpan = () => {
    const [a, b] = touches.values();
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function handlePointerDown(event) {
    if (event.pointerType !== 'touch') return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchDistance = touches.size === 2 ? pinchSpan() : 0;
  }

  function handlePointerMove(event) {
    const touch = touches.get(event.pointerId);
    if (!touch) return;
    touch.x = event.clientX;
    touch.y = event.clientY;
    if (touches.size !== 2) return;
    const distance = pinchSpan();
    // Jari mendekat = zoom keluar
    if (pinchDistance > 0 && distance > 0) apply(Math.log10(pinchDistance / distance) * PINCH_GAIN);
    pinchDistance = distance;
  }

  function handlePointerUp(event) {
    if (!touches.delete(event.pointerId)) return;
    pinchDistance = touches.size === 2 ? pinchSpan() : 0;
    syncControls();
  }

  // Listener OrbitControls sudah terpasang duluan (waktu controls dibuat), jadi selalu jalan
  // lebih dulu. Waktu kamera mentok, scroll keluar dia abaikan sendiri karena sudah di maxDistance
  domElement.addEventListener('wheel', handleWheel, { passive: false });
  domElement.addEventListener('pointerdown', handlePointerDown);
  domElement.addEventListener('pointermove', handlePointerMove);
  domElement.addEventListener('pointerup', handlePointerUp);
  domElement.addEventListener('pointercancel', handlePointerUp);

  return {
    // Balik ke tata surya (offset 0) secara halus, dipakai sebelum terbang ke benda / ganti skala / tur
    reset() {
      setTarget(0);
    },
    // Dipanggil di awal tiap frame
    update(delta) {
      offset += (target - offset) * (1 - Math.exp(-delta * VIRTUAL_DAMPING));
      if (Math.abs(target - offset) < 1e-4) offset = target;
    },
    // Offset zoomLevel yang sedang dipakai (sudah di-damp)
    get offset() {
      return offset;
    },
    // true selama masih ada sisa zoom virtual, termasuk waktu sedang balik
    get active() {
      return offset > 0 || target > 0;
    }
  };
}
