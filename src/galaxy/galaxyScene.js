import * as THREE from 'three';
import { galacticOrientation } from '../scene/milkyWay.js';
import { auToGalaxyUnits, zoomLevelToAU, fadeBetween, STAGES, GALAXY_TEXTURE_LOAD_AT } from './zoomLevels.js';
import { createGalaxyParticles } from './galaxyParticles.js';
import { createGalaxyTexture } from './galaxyTexture.js';

// Scene galaksi, dirender di lapisan bawah sebelum tata surya (render berlapis)
//
// Jarak Neptunus (30 AU) dan diameter Bima Sakti (sekitar 6,3 miliar AU) gak muat di satu
// koordinat float32. Jadi galaksi punya scene dan kamera sendiri dengan satuan
// 1 unit = 100 tahun cahaya. Tiap frame urutannya galaxyScene dulu, depth buffer dikosongkan,
// baru tata surya. Tata surya selalu tergambar di atas galaksi tanpa rebutan depth
//
// Di awal, titik (0,0,0) galaxyScene = posisi Matahari. Isi galaksi ditaruh di grup `galaxy` yang
// digeser supaya pusat galaksi ada di tempat yang benar relatif ke Matahari. Waktu galaksi berputar,
// Matahari ikut terbawa di lengan Orion dan pindah dari titik asal, kamera galaksi ngikutin.
// Presisi tetap aman: matriks kamera dihitung three.js dalam double di JS, dan galat float32
// di sekitar 500 unit (sekitar 3e-5) jauh lebih kecil dari jarak partikel terdekat

// Matahari sekitar 26.000 tahun cahaya dari pusat galaksi, sedikit di atas bidangnya (sekitar 65 tahun cahaya)
export const SUN_GALACTIC_RADIUS = 260;
export const SUN_GALACTIC_HEIGHT = 0.65;

// Near plane kamera galaksi sebanding jaraknya ke Matahari, far plane cukup buat seluruh galaksi
const NEAR_RATIO = 0.01;
const NEAR_MIN = 1e-4;
const NEAR_MAX = 1;
const FAR_MARGIN = 3000;

// Galaksi berputar pelan di pusatnya, cukup buat kesan hidup (bukan kecepatan asli).
// Satu putaran 30 menit, searah jarum jam dilihat dari kutub utara galaksi (theta membesar),
// jadi lengan yang melengkung ke arah theta mengecil (workers/galaxyWorker.js) "tertinggal" (trailing)
const ROTATION_PERIOD = 30 * 60;

export function createGalaxyScene({ renderer, pixelRatio = 1, anisotropy = 1 }) {
  const scene = new THREE.Scene();
  scene.name = 'galaxy-scene';
  // Latar hitam pindah ke sini, scene tata surya dirender tanpa latar di atasnya
  scene.background = new THREE.Color('#010104');

  const camera = new THREE.PerspectiveCamera(50, 1, NEAR_MIN, FAR_MARGIN);

  // Grup isi galaksi dalam koordinat galaksi: pusat galaksi di (0,0,0), piringan di bidang XZ,
  // Matahari di sumbu -X. Orientasinya disamakan dengan pita Bima Sakti di latar (scene/milkyWay.js):
  // sumbu Y = kutub galaksi, +X = arah pusat galaksi dilihat dari Matahari.
  //
  // galaxy (orientasi + geser, diam) > content (berputar di sumbu kutub lewat pusat galaksi) > partikel.
  // Matahari ikut berputar bersama piringannya: posisinya tetap di koordinat content, jadi
  // lingkungan sekitarnya (taji Orion) gak bergeser relatif ke Matahari. Posisi dunianya
  // (sunPosition) dihitung ulang tiap frame, dipakai kamera galaksi dan penanda "Kamu di sini"
  const sunLocal = new THREE.Vector3(-SUN_GALACTIC_RADIUS, SUN_GALACTIC_HEIGHT, 0);
  const galaxy = new THREE.Group();
  galaxy.name = 'galaxy';
  galaxy.quaternion.copy(galacticOrientation());
  // Digeser sekali: di putaran 0 Matahari tepat di titik asal
  galaxy.position.copy(sunLocal).applyQuaternion(galaxy.quaternion).negate();
  scene.add(galaxy);

  const content = new THREE.Group();
  content.name = 'galaxy-content';
  galaxy.add(content);

  const texture = createGalaxyTexture({ renderer, anisotropy });
  content.add(texture.mesh);

  const particles = createGalaxyParticles({ pixelRatio });
  content.add(particles.group);

  // Posisi Matahari di galaxyScene sekarang
  const sunPosition = new THREE.Vector3();

  function rotate(elapsed) {
    // rotation.y negatif = theta membesar (lihat galaxyWorker.js soal arah sudut)
    content.rotation.y = -(elapsed / ROTATION_PERIOD) * Math.PI * 2;
    content.updateMatrixWorld(true);
    content.localToWorld(sunPosition.copy(sunLocal));
  }
  rotate(0);

  const direction = new THREE.Vector3();

  return {
    scene,
    camera,
    galaxy,
    content,
    particles,
    texture,
    sunPosition,
    // Partikel dibuat di worker, sekali saja. Tekstur dimuat belakangan (lihat update)
    prepare(total) {
      particles.generate(total);
    },
    // Kamera galaksi ikut orientasi kamera utama. Posisinya di arah yang sama dari Matahari (yang ikut
    // berputar bersama galaksi)
    // dengan jarak dari zoomLevel (sudah termasuk zoom virtual), dikonversi ke satuan galaksi.
    // Jadi Matahari di kedua scene selalu jatuh di titik layar yang sama.
    // frame = { delta, elapsed, viewportHeight (piksel device) }
    update(mainCamera, zoomLevel, fit, { delta, elapsed, viewportHeight }) {
      rotate(elapsed);
      particles.setOpacity(fadeBetween(zoomLevel, STAGES.galaxyIn.start, STAGES.galaxyIn.end));
      if (particles.state === 'ready' && zoomLevel >= GALAXY_TEXTURE_LOAD_AT) texture.load();
      texture.update(fadeBetween(zoomLevel, STAGES.galaxyTexture.start, STAGES.galaxyTexture.end), delta);

      const distance = auToGalaxyUnits(zoomLevelToAU(zoomLevel, fit));
      direction.copy(mainCamera.position);
      if (direction.lengthSq() < 1e-12) direction.set(0, 0, 1);
      camera.position.copy(direction.normalize()).multiplyScalar(distance).add(sunPosition);
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
