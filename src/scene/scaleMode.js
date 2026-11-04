import * as THREE from 'three';
import gsap from 'gsap';
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

// Pengaturan kamera tiap mode. Posisi overview-nya dihitung lewat overviewPositionAt()
export const CAMERA_SETTINGS = {
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

// Posisi overview untuk nilai k mana pun, mundur sebanding dengan dunianya
export function overviewPositionAt(k, target = new THREE.Vector3()) {
  return target.copy(OVERVIEW_POSITION).multiplyScalar(blendScale(1, OVERVIEW_GROWTH, k));
}

export function createScaleMode({ sun, planets, moons, asteroidBelt }) {
  const state = { k: 0 };
  let mode = 'pretty';
  let tween = null;

  function apply() {
    sun.applyScale(state.k);
    planets.applyScale(state.k);
    moons.applyScale(state.k);
    asteroidBelt.applyScale(state.k);
  }

  // Pindah mode. Kalau dipanggil di tengah transisi, tween lama ditimpa dan transisi
  // lanjut dari k yang sekarang, jadi bisa bolak balik tanpa loncat
  function set(nextMode, { onUpdate, onComplete } = {}) {
    mode = nextMode;
    tween?.kill();
    tween = gsap.to(state, {
      k: nextMode === 'real' ? 1 : 0,
      duration: SCALE_TRANSITION_DURATION,
      ease: EASE,
      onUpdate: () => {
        apply();
        onUpdate?.(state.k);
      },
      onComplete: () => {
        tween = null;
        onComplete?.();
      }
    });
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
