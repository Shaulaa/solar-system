import * as THREE from 'three';
import { galacticOrientation } from '../scene/milkyWay.js';
import { auToGalaxyUnits, zoomLevelToAU, fadeBetween, STAGES } from './zoomLevels.js';
import { createGalaxyParticles } from './galaxyParticles.js';

// Scene galaksi, dirender di lapisan bawah sebelum tata surya (render berlapis)
//
// Jarak Neptunus (30 AU) dan diameter Bima Sakti (sekitar 6,3 miliar AU) gak muat di satu
// koordinat float32. Jadi galaksi punya scene dan kamera sendiri dengan satuan
// 1 unit = 100 tahun cahaya. Tiap frame urutannya galaxyScene dulu, depth buffer dikosongkan,
// baru tata surya. Tata surya selalu tergambar di atas galaksi tanpa rebutan depth
//
// Titik (0,0,0) galaxyScene = posisi Matahari, jadi kamera galaksi selalu dekat titik asal
// waktu zoomLevel kecil (presisi aman). Isi galaksi ditaruh di grup `galaxy` yang digeser
// supaya pusat galaksi ada di tempat yang benar relatif ke Matahari

// Matahari sekitar 26.000 tahun cahaya dari pusat galaksi, sedikit di atas bidangnya (sekitar 65 tahun cahaya)
export const SUN_GALACTIC_RADIUS = 260;
export const SUN_GALACTIC_HEIGHT = 0.65;

// Near plane kamera galaksi sebanding jaraknya ke Matahari, far plane cukup buat seluruh galaksi
const NEAR_RATIO = 0.01;
const NEAR_MIN = 1e-4;
const NEAR_MAX = 1;
const FAR_MARGIN = 3000;

// Galaksi berputar pelan, cukup buat kesan hidup (bukan kecepatan asli).
// Satu putaran 30 menit. Arahnya bikin lengan spiral "tertinggal" (trailing) seperti galaksi asli
const ROTATION_PERIOD = 30 * 60;

export function createGalaxyScene({ pixelRatio = 1 } = {}) {
  const scene = new THREE.Scene();
  scene.name = 'galaxy-scene';
  // Latar hitam pindah ke sini, scene tata surya dirender tanpa latar di atasnya
  scene.background = new THREE.Color('#010104');

  const camera = new THREE.PerspectiveCamera(50, 1, NEAR_MIN, FAR_MARGIN);

  // Grup isi galaksi dalam koordinat galaksi: pusat galaksi di (0,0,0), piringan di bidang XZ,
  // Matahari di sumbu -X. Orientasinya disamakan dengan pita Bima Sakti di latar (scene/milkyWay.js):
  // sumbu Y = kutub galaksi, +X = arah pusat galaksi dilihat dari Matahari.
  //
  // galaxy (orientasi + geser) > content (berputar di sumbu kutub) > partikel.
  // Matahari ikut berputar bersama piringannya (posisinya tetap di koordinat content), jadi
  // tiap frame galaxy digeser supaya Matahari tetap di titik asal. Hasilnya galaksi berputar
  // di sumbu kutub yang lewat Matahari: lingkungan sekitar Matahari (taji Orion) gak bergeser,
  // dan registrasi dengan tata surya / penanda "Kamu di sini" tetap pas
  const galaxy = new THREE.Group();
  galaxy.name = 'galaxy';
  galaxy.quaternion.copy(galacticOrientation());
  scene.add(galaxy);

  const content = new THREE.Group();
  content.name = 'galaxy-content';
  galaxy.add(content);

  const particles = createGalaxyParticles({ pixelRatio });
  content.add(particles.group);

  const sunLocal = new THREE.Vector3(-SUN_GALACTIC_RADIUS, SUN_GALACTIC_HEIGHT, 0);
  const sunWorld = new THREE.Vector3();

  function placeSunAtOrigin(elapsed) {
    content.rotation.y = (elapsed / ROTATION_PERIOD) * Math.PI * 2;
    sunWorld.copy(sunLocal).applyEuler(content.rotation).applyQuaternion(galaxy.quaternion);
    galaxy.position.copy(sunWorld).negate();
  }
  placeSunAtOrigin(0);

  const direction = new THREE.Vector3();

  return {
    scene,
    camera,
    galaxy,
    content,
    particles,
    // Kamera galaksi ikut orientasi kamera utama. Posisinya di arah yang sama dari Matahari
    // dengan jarak dari zoomLevel (sudah termasuk zoom virtual), dikonversi ke satuan galaksi.
    // Jadi Matahari di kedua scene selalu jatuh di titik layar yang sama.
    // frame = { delta, elapsed, viewportHeight (piksel device) }
    update(mainCamera, zoomLevel, fit, { delta, elapsed, viewportHeight }) {
      placeSunAtOrigin(elapsed);
      particles.setOpacity(fadeBetween(zoomLevel, STAGES.galaxyIn.start, STAGES.galaxyIn.end));

      const distance = auToGalaxyUnits(zoomLevelToAU(zoomLevel, fit));
      direction.copy(mainCamera.position);
      if (direction.lengthSq() < 1e-12) direction.set(0, 0, 1);
      camera.position.copy(direction.normalize()).multiplyScalar(distance);
      camera.quaternion.copy(mainCamera.quaternion);

      // Proyeksi disamakan, termasuk geseran framing panel info (setViewOffset)
      camera.fov = mainCamera.fov;
      camera.aspect = mainCamera.aspect;
      camera.near = THREE.MathUtils.clamp(distance * NEAR_RATIO, NEAR_MIN, NEAR_MAX);
      camera.far = distance + FAR_MARGIN;
      const view = mainCamera.view;
      if (view?.enabled) {
        camera.setViewOffset(view.fullWidth, view.fullHeight, view.offsetX, view.offsetY, view.width, view.height);
      } else if (camera.view?.enabled) {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
      particles.update(delta, camera, viewportHeight);
    }
  };
}
