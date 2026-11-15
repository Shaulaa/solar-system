import * as THREE from 'three';
import { galacticOrientation } from '../scene/milkyWay.js';
import {
  auToGalaxyUnits,
  zoomLevelToAU,
  fadeBetween,
  galaxyViewFit,
  STAGES,
  GALAXY_TEXTURE_LOAD_AT
} from './zoomLevels.js';
import { createGalaxyParticles } from './galaxyParticles.js';
import { createGalaxyTexture } from './galaxyTexture.js';
import { createYouAreHere } from './youAreHere.js';
import { OVERVIEW_POSITION } from '../controls/cameraRig.js';

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

// Tampilan atas galaksi di akhir jalur kamera: elevasi 65 derajat dari bidang galaksi (25 derajat dari
// tegak lurus), dari sisi Matahari, jadi Matahari ada di bawah pusat seperti ilustrasi NASA.
// Di zoom maksimal user tetap bisa muter: geser kiri kanan memutar galaksi di sumbu kutubnya,
// geser atas bawah mengubah kemiringan. Dua duanya diturunkan dari sudut kamera tata surya relatif
// ke posisi overview default, jadi posisi default tepat menghasilkan kemiringan 25 derajat
const DEG = Math.PI / 180;
const TOP_ELEVATION = 65 * DEG;
const ELEVATION_RANGE = [15 * DEG, 88 * DEG];
const OVERVIEW_SPHERICAL = new THREE.Spherical().setFromVector3(OVERVIEW_POSITION);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
// Pusat pandang pindah dari Matahari ke pusat galaksi sejauh paling banyak CENTER_FOLLOW kali jarak
// kamera (dihaluskan smoothstep), jadi Matahari selalu tetap di dalam layar selama perpindahan.
// Pusat galaksi penuh di tengah layar mulai sekitar 1040 unit (zoomLevel sekitar 9,82). Dengan 0,3
// Matahari sempat turun sampai dekat toolbar (y 655 dari 768) di zoomLevel 9,5
// Versi yang diatur dari zoomLevel (7,8 sampai 9,6) melempar Matahari keluar layar di zoomLevel 8,
// karena di sana kamera baru sekitar 16 unit dari Matahari sedangkan pusat galaksi 260 unit
const CENTER_FOLLOW = 0.25;

export function createGalaxyScene({ renderer, pixelRatio = 1, anisotropy = 1 }) {
  const youAreHere = createYouAreHere({ pixelRatio });
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
  scene.add(youAreHere.points);

  // Vektor kerja jalur kamera, dibuat sekali
  const solarDirection = new THREE.Vector3();
  const topDirection = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const center = new THREE.Vector3();
  const north = new THREE.Vector3();
  const up = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const sunInGalaxy = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  const turn = new THREE.Quaternion();
  const lookQuaternion = new THREE.Quaternion();
  const lookMatrix = new THREE.Matrix4();
  const partialTurn = new THREE.Quaternion();

  // Arah kamera tampilan atas (world), dari sudut kamera tata surya terhadap titik yang dilihatnya
  function computeTopDirection(mainCamera, mainTarget) {
    spherical.setFromVector3(offset.subVectors(mainCamera.position, mainTarget));
    // Sudut Matahari di bidang galaksi, dihitung di koordinat grup galaxy (sebelum rotasi isi)
    galaxy.worldToLocal(sunInGalaxy.copy(sunPosition));
    const azimuth = Math.atan2(sunInGalaxy.z, sunInGalaxy.x) + (spherical.theta - OVERVIEW_SPHERICAL.theta);
    const elevation = THREE.MathUtils.clamp(
      TOP_ELEVATION + (OVERVIEW_SPHERICAL.phi - spherical.phi),
      ELEVATION_RANGE[0],
      ELEVATION_RANGE[1]
    );
    topDirection
      .set(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth))
      .applyQuaternion(galaxy.quaternion);
  }

  return {
    scene,
    camera,
    galaxy,
    content,
    particles,
    texture,
    youAreHere,
    sunPosition,
    // Partikel dibuat di worker, sekali saja. Tekstur dimuat belakangan (lihat update)
    prepare(total) {
      particles.generate(total);
    },
    setPixelRatio(ratio) {
      particles.setPixelRatio(ratio);
      youAreHere.setPixelRatio(ratio);
    },
    // Kamera galaksi. Jaraknya dari zoomLevel (sudah termasuk zoom virtual), dikonversi ke satuan galaksi
    //   sebelum galaxyTilt   arah dan orientasi sama persis dengan kamera tata surya, berpusat di
    //                        Matahari, jadi Matahari di dua scene jatuh di titik layar yang sama
    //   galaxyTilt           arah kamera berputar halus ke tampilan atas serong, "atas" layar ikut
    //                        pindah ke kutub utara galaksi
    //   galaxyCenter         titik yang dilihat pindah dari Matahari ke pusat galaksi
    // frame = { delta, elapsed, viewportHeight (piksel device), cssWidth, cssHeight, mainTarget }
    update(mainCamera, zoomLevel, fit, { delta, elapsed, viewportHeight, cssWidth, cssHeight, mainTarget }) {
      rotate(elapsed);
      particles.setOpacity(fadeBetween(zoomLevel, STAGES.galaxyIn.start, STAGES.galaxyIn.end));
      if (particles.state === 'ready' && zoomLevel >= GALAXY_TEXTURE_LOAD_AT) texture.load();
      texture.update(fadeBetween(zoomLevel, STAGES.galaxyTexture.start, STAGES.galaxyTexture.end), delta);

      const tilt = fadeBetween(zoomLevel, STAGES.galaxyTilt.start, STAGES.galaxyTilt.end);
      // Sebelum jalur kamera belok, jaraknya pakai fit tata surya (biar Matahari tetap sejajar dua scene).
      // Sepanjang jalur pindah halus (geometris) ke faktor bingkai galaksi dari sisi layar terpendek
      const viewFit = Math.pow(fit, 1 - tilt) * Math.pow(galaxyViewFit(mainCamera.aspect, mainCamera.fov), tilt);
      const distance = auToGalaxyUnits(zoomLevelToAU(zoomLevel, viewFit));
      content.getWorldPosition(center);
      const follow = tilt === 0 ? 0 : Math.min((CENTER_FOLLOW * distance) / center.distanceTo(sunPosition), 1);
      const centering = follow * follow * (3 - 2 * follow);

      solarDirection.copy(mainCamera.position);
      if (solarDirection.lengthSq() < 1e-12) solarDirection.set(0, 0, 1);
      solarDirection.normalize();

      if (tilt === 0 && centering === 0) {
        camera.position.copy(solarDirection).multiplyScalar(distance).add(sunPosition);
        camera.quaternion.copy(mainCamera.quaternion);
      } else {
        computeTopDirection(mainCamera, mainTarget);
        // Putaran halus (slerp) dari arah kamera tata surya ke arah tampilan atas
        turn.setFromUnitVectors(solarDirection, topDirection);
        direction.copy(solarDirection).applyQuaternion(partialTurn.identity().slerp(turn, tilt));
        lookTarget.lerpVectors(sunPosition, center, centering);
        camera.position.copy(direction).multiplyScalar(distance).add(lookTarget);

        north.set(0, 1, 0).applyQuaternion(galaxy.quaternion);
        up.copy(WORLD_UP).lerp(north, tilt).normalize();
        lookMatrix.lookAt(camera.position, lookTarget, up);
        lookQuaternion.setFromRotationMatrix(lookMatrix);
        // Serah terima orientasi dari kamera tata surya dibikin halus di awal jalur, biar gak
        // loncat kalau kamera tata surya lagi melihat titik selain Matahari (misal habis digeser)
        const handoff = fadeBetween(zoomLevel, STAGES.galaxyTilt.start, STAGES.galaxyTilt.start + 0.4);
        camera.quaternion.copy(mainCamera.quaternion).slerp(lookQuaternion, handoff);
      }

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
      camera.updateMatrixWorld();
      particles.update(delta, camera, viewportHeight);
      youAreHere.update({
        position: sunPosition,
        camera,
        opacity: fadeBetween(zoomLevel, STAGES.youAreHere.start, STAGES.youAreHere.end),
        ringOpacity: fadeBetween(zoomLevel, STAGES.youAreHereRing.start, STAGES.youAreHereRing.end),
        elapsed,
        width: cssWidth,
        height: cssHeight
      });
    }
  };
}
