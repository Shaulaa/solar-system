import * as THREE from 'three';
import gsap from 'gsap';
import { motion } from '../utils/motion.js';
import { planets as planetData } from '../data/planets.js';
import { scaleDistance, sunRadius, blendScale } from '../utils/scale.js';
import { OVERVIEW_POSITION } from '../controls/cameraRig.js';

// Transisi antar mode skala (Enak Dilihat dan Skala Nyata)
//
// k = 0 berarti mode pretty, k = 1 berarti mode real. Nilai di antaranya dipakai selama
// transisi 2,5 detik: radius tiap benda, posisi anchor, garis orbit, dan sabuk asteroid
// diinterpolasi bareng dari k yang sama, jadi semuanya bergerak serempak

export const SCALE_TRANSITION_DURATION = 2.5;
const EASE = 'power3.inOut';

// Seberapa jauh kamera overview harus mundur di mode nyata, disamain dengan
// seberapa jauh orbit terluar (Neptunus) melebar. Jadi komposisi overview tetap mirip
const outermost = planetData[planetData.length - 1].distance;
const OVERVIEW_GROWTH = scaleDistance(outermost, 'real') / scaleDistance(outermost);

// Layar sempit (HP portrait) sudut pandang horizontalnya sempit, orbit luar kepotong kiri kanan.
// Komposisi overview default pas buat rasio layar segini (orbit Neptunus pas muat lebarnya),
// di bawahnya kamera overview mundur. Mundurnya gak penuh sebanding (dipangkatkan 0.85),
// jadi di HP planet gak terlalu kecil, dan orbit Neptunus cuma kepotong sedikit di kiri kanan
const OVERVIEW_FIT_ASPECT = 1.75;
const OVERVIEW_FIT_POWER = 0.85;

export function overviewFit(aspect) {
  return Math.max(1, Math.pow(OVERVIEW_FIT_ASPECT / aspect, OVERVIEW_FIT_POWER));
}

// Sudut kamera overview di atas bidang orbit. Mundur karena layar sempit cuma menyelesaikan lebarnya:
// dari sudut 25 derajat orbit Neptunus kelihatan sebagai elips setinggi 0,42x lebarnya, jadi di HP
// portrait tata suryanya jadi pita tipis di tengah layar dengan langit kosong di atas dan bawahnya.
// Makin sempit layarnya (fit makin besar) kamera makin naik, sampai 52 derajat (elips setinggi 0,79x
// lebarnya). Jarak kameranya tetap sama, jadi zoomLevel dan batas zoom gak berubah. Layar lebar dan
// laptop (fit di bawah 1,3) tetap 25 derajat seperti biasa
const BASE_ELEVATION = Math.atan2(OVERVIEW_POSITION.y, OVERVIEW_POSITION.z);
const PORTRAIT_ELEVATION = THREE.MathUtils.degToRad(52);
const ELEVATION_FIT_RANGE = [1.3, 2.6];

export function overviewElevation(fit = 1) {
  const t = THREE.MathUtils.smoothstep(fit, ELEVATION_FIT_RANGE[0], ELEVATION_FIT_RANGE[1]);
  return THREE.MathUtils.lerp(BASE_ELEVATION, PORTRAIT_ELEVATION, t);
}

// Pengaturan kamera dasar tiap mode (layar lebar). Pakai cameraSettings() biar ikut layar sempit
const CAMERA_SETTINGS = {
  pretty: {
    minDistance: 15,
    maxDistance: 600,
    far: 5000
  },
  real: {
    minDistance: sunRadius('real') * 3,
    maxDistance: OVERVIEW_POSITION.length() * OVERVIEW_GROWTH * 2,
    far: 60000
  }
};

// maxDistance dan far ikut dikali fit, kalau nggak kamera overview yang mundur kena batas zoom
// dan sisi jauh orbit Neptunus kepotong far plane
export function cameraSettings(mode, fit = 1) {
  const base = CAMERA_SETTINGS[mode];
  return {
    minDistance: base.minDistance,
    maxDistance: base.maxDistance * fit,
    far: base.far * fit
  };
}

// Posisi overview untuk nilai k mana pun, mundur sebanding dengan dunianya (dan lebar layar).
// Arahnya dari overviewElevation, di layar lebar sama persis dengan OVERVIEW_POSITION
export function overviewPositionAt(k, fit = 1, target = new THREE.Vector3()) {
  const distance = OVERVIEW_POSITION.length() * blendScale(1, OVERVIEW_GROWTH, k) * fit;
  const elevation = overviewElevation(fit);
  return target.set(0, Math.sin(elevation) * distance, Math.cos(elevation) * distance);
}

export function createScaleMode({ sun, planets, moons, asteroidBelt, orbits }) {
  const state = { k: 0 };
  let mode = 'pretty';
  let tween = null;

  function apply() {
    sun.applyScale(state.k);
    planets.applyScale(state.k);
    moons.applyScale(state.k);
    asteroidBelt.applyScale(state.k);
    orbits.applyScale(state.k);
  }

  // Pindah mode. Kalau dipanggil di tengah transisi, tween lama ditimpa dan transisi
  // lanjut dari k yang sekarang, jadi bisa bolak balik tanpa loncat.
  // instant: langsung jadi tanpa transisi (memulihkan keadaan setelah ganti bahasa, lihat app/session.js)
  function set(nextMode, { onUpdate, onComplete, instant = false } = {}) {
    mode = nextMode;
    tween?.kill();
    // Dengan prefers-reduced-motion durasinya 0 dan onComplete sudah jalan di dalam gsap.to(),
    // jadi tween yang sudah selesai gak boleh disimpan (transitioning bakal nyangkut true)
    let finished = false;
    let created = null;
    created = gsap.to(state, {
      k: nextMode === 'real' ? 1 : 0,
      duration: instant ? 0 : motion(SCALE_TRANSITION_DURATION),
      ease: EASE,
      onUpdate: () => {
        apply();
        onUpdate?.(state.k);
      },
      onComplete: () => {
        finished = true;
        if (tween === created) tween = null;
        onComplete?.();
      }
    });
    tween = finished ? null : created;
  }

  return {
    set,
    get mode() {
      return mode;
    },
    get k() {
      return state.k;
    },
    get transitioning() {
      return tween !== null;
    }
  };
}
