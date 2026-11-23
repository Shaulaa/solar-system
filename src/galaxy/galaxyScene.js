import * as THREE from 'three';
import { galacticOrientation } from '../scene/milkyWay.js';
import {
  auToGalaxyUnits,
  zoomLevelToAU,
  fadeBetween,
  galaxyViewFit,
  localGroupViewFit,
  STAGES,
  GALAXY_TEXTURE_LOAD_AT,
  MAX_ZOOM_LEVEL
} from './zoomLevels.js';
import { createGalaxyParticles } from './galaxyParticles.js';
import { createGalaxyTexture } from './galaxyTexture.js';
import { createYouAreHere } from './youAreHere.js';
import { createNearbyStars } from './nearbyStars.js';
import { createLocalGroup } from './localGroup.js';
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

// Kecerahan partikel galaksi selama tahap bintang tetangga (lihat STAGES.neighborhoodOut)
const NEIGHBORHOOD_DIM = 0.3;

// Kotak cadangan levelForStar (NDC), dipakai kalau kotak yang diminta gak ketemu
const LOOSE_STAR_BOX = { xMin: -0.88, xMax: 0.88, yMin: -0.85, yMax: 0.85 };

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

  const particles = createGalaxyParticles({ pixelRatio, sunLocal });
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

  const nearbyStars = createNearbyStars({ pixelRatio, sunLocal });
  content.add(nearbyStars.points);

  // Galaksi Grup Lokal di grup `galaxy` (gak ikut berputar). Pusat bingkainya di world dihitung sekali,
  // grup `galaxy` gak pernah bergerak
  const localGroup = createLocalGroup({ pixelRatio, sunLocal });
  galaxy.add(localGroup.group);
  galaxy.updateMatrixWorld(true);
  const localGroupCenter = galaxy.localToWorld(localGroup.center.clone());
  // Sumbu panjang Grup Lokal (dari pusat Bima Sakti ke pusat bingkainya, kira kira ke arah Triangulum)
  const localGroupAxis = localGroupCenter.clone().sub(galaxy.localToWorld(new THREE.Vector3())).normalize();

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
  const viewDirection = new THREE.Vector3();
  const groupUp = new THREE.Vector3();

  // Jarak kamera galaksi ke titik yang dilihatnya (unit galaksi), dipakai penggaris skala
  let viewDistance = 0;

  // Kamera bayangan buat nyari zoomLevel yang pas untuk satu bintang tetangga (levelForStar)
  const probe = new THREE.PerspectiveCamera(50, 1, NEAR_MIN, FAR_MARGIN);
  const probeStar = new THREE.Vector3();
  const probeNdc = new THREE.Vector3();

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
    nearbyStars,
    localGroup,
    sunPosition,
    // Partikel dibuat di worker, sekali saja. Tekstur dimuat belakangan (lihat update)
    prepare(total) {
      particles.generate(total);
    },
    setPixelRatio(ratio) {
      particles.setPixelRatio(ratio);
      youAreHere.setPixelRatio(ratio);
      nearbyStars.setPixelRatio(ratio);
      localGroup.setPixelRatio(ratio);
    },
    get viewDistance() {
      return viewDistance;
    },
    // zoomLevel terkecil di [from, to] yang menaruh bintang tetangga ke-index di dalam layar
    // (di dalam kotak NDC `box`, dihitung sebelum geseran framing panel) dengan arah kamera tata surya sekarang. Rentangnya
    // di tahap bintang tetangga selama bintangnya masih bisa diklik (di 6,8 opacity-nya masih sekitar
    // 0,74, lihat nearbyStarsOut). Jalur kamera galaksi di sana baru belok sekitar 3% (galaxyTilt),
    // jadi posisi kamera galaksi dianggap cuma fungsi dari zoomLevel (cabang tilt = 0 di update). box dari main.js, tergantung panel info nutupin sisi mana layar.
    // Kalau gak ada yang pas, dicoba sekali lagi dengan kotak longgar (bintangnya mungkin ketutup
    // sebagian panel, tapi tetap di layar), baru menyerah di `to`
    levelForStar(index, mainCamera, fit, box, { from = 4.8, to = 6.8, step = 0.05 } = {}) {
      nearbyStars.getWorldPosition(index, probeStar);
      solarDirection.copy(mainCamera.position);
      if (solarDirection.lengthSq() < 1e-12) solarDirection.set(0, 0, 1);
      solarDirection.normalize();
      probe.fov = mainCamera.fov;
      probe.aspect = mainCamera.aspect;
      probe.quaternion.copy(mainCamera.quaternion);
      for (const { xMin, xMax, yMin, yMax } of [box, LOOSE_STAR_BOX]) {
        for (let level = from; level < to; level += step) {
          const distance = auToGalaxyUnits(zoomLevelToAU(level, fit));
          probe.near = THREE.MathUtils.clamp(distance * NEAR_RATIO, NEAR_MIN, NEAR_MAX);
          probe.far = distance + FAR_MARGIN;
          probe.updateProjectionMatrix();
          probe.position.copy(solarDirection).multiplyScalar(distance).add(sunPosition);
          probe.updateMatrixWorld();
          probeNdc.copy(probeStar).project(probe);
          if (probeNdc.z > -1 && probeNdc.z < 1 && probeNdc.x > xMin && probeNdc.x < xMax && probeNdc.y > yMin && probeNdc.y < yMax) {
            return level;
          }
        }
      }
      return to;
    },
    // Kamera galaksi. Jaraknya dari zoomLevel (sudah termasuk zoom virtual), dikonversi ke satuan galaksi
    //   sebelum galaxyTilt   arah dan orientasi sama persis dengan kamera tata surya, berpusat di
    //                        Matahari, jadi Matahari di dua scene jatuh di titik layar yang sama
    //   galaxyTilt           arah kamera berputar halus ke tampilan atas serong, "atas" layar ikut
    //                        pindah ke kutub utara galaksi
    //   galaxyCenter         titik yang dilihat pindah dari Matahari ke pusat galaksi
    //   localGroupView       titik yang dilihat pindah lagi ke pusat Grup Lokal, bingkainya melebar
    //                        dari galaksi utuh ke Grup Lokal utuh
    // frame = { delta, elapsed, viewportHeight (piksel device), cssWidth, cssHeight, mainTarget }
    update(mainCamera, zoomLevel, fit, { delta, elapsed, viewportHeight, cssWidth, cssHeight, mainTarget }) {
      rotate(elapsed);
      const neighborhood = 1 - fadeBetween(zoomLevel, STAGES.neighborhoodOut.start, STAGES.neighborhoodOut.end);
      // Dipakai juga galaksi Grup Lokal: Awan Magellan kelihatan di langit selama tahap bintang tetangga,
      // jadi ikut diredupkan bareng partikel Bima Sakti
      const galaxyOpacity =
        fadeBetween(zoomLevel, STAGES.galaxyIn.start, STAGES.galaxyIn.end) * THREE.MathUtils.lerp(1, NEIGHBORHOOD_DIM, neighborhood);
      particles.setOpacity(galaxyOpacity);
      particles.setLocalClearing(neighborhood);
      if (particles.state === 'ready' && zoomLevel >= GALAXY_TEXTURE_LOAD_AT) texture.load();
      texture.update(fadeBetween(zoomLevel, STAGES.galaxyTexture.start, STAGES.galaxyTexture.end), delta);

      const tilt = fadeBetween(zoomLevel, STAGES.galaxyTilt.start, STAGES.galaxyTilt.end);
      // Sebelum jalur kamera belok, jaraknya pakai fit tata surya (biar Matahari tetap sejajar dua scene).
      // Sepanjang jalur pindah halus (geometris) ke faktor bingkai galaksi dari sisi layar terpendek,
      // lalu di tahap Grup Lokal ke faktor bingkai Grup Lokal
      const galaxyFit = Math.pow(fit, 1 - tilt) * Math.pow(galaxyViewFit(mainCamera.aspect, mainCamera.fov), tilt);
      const groupFit = localGroupViewFit(mainCamera.aspect, mainCamera.fov, localGroup.frameRadius);
      const { start: groupStart } = STAGES.localGroupView;
      const groupBlend = fadeBetween(zoomLevel, groupStart, STAGES.localGroupView.end);
      const viewFit = groupBlend > 0 ? Math.pow(galaxyFit, 1 - groupBlend) * Math.pow(groupFit, groupBlend) : galaxyFit;
      const distance = auToGalaxyUnits(zoomLevelToAU(zoomLevel, viewFit));
      viewDistance = distance;
      content.getWorldPosition(center);
      const follow = tilt === 0 ? 0 : Math.min((CENTER_FOLLOW * distance) / center.distanceTo(sunPosition), 1);
      const centering = follow * follow * (3 - 2 * follow);
      // Pusat pandang ke pusat Grup Lokal sebanding pertambahan jarak kamera: 0 di tampilan galaksi utuh,
      // 1 di zoom maksimal. Karena jaraknya naik 10x tiap dekade, pergeserannya selalu kecil dibanding
      // lebar layar dan Bima Sakti gak pernah keluar layar di tengah jalan
      let groupFollow = 0;
      if (zoomLevel > groupStart) {
        const fromDistance = auToGalaxyUnits(zoomLevelToAU(groupStart, viewFit));
        const toDistance = auToGalaxyUnits(zoomLevelToAU(MAX_ZOOM_LEVEL, groupFit));
        groupFollow = THREE.MathUtils.clamp((distance - fromDistance) / (toDistance - fromDistance), 0, 1);
      }

      solarDirection.copy(mainCamera.position);
      if (solarDirection.lengthSq() < 1e-12) solarDirection.set(0, 0, 1);
      solarDirection.normalize();

      if (tilt === 0 && centering === 0) {
        lookTarget.copy(sunPosition);
        camera.position.copy(solarDirection).multiplyScalar(distance).add(sunPosition);
        camera.quaternion.copy(mainCamera.quaternion);
      } else {
        computeTopDirection(mainCamera, mainTarget);
        // Putaran halus (slerp) dari arah kamera tata surya ke arah tampilan atas
        turn.setFromUnitVectors(solarDirection, topDirection);
        direction.copy(solarDirection).applyQuaternion(partialTurn.identity().slerp(turn, tilt));
        lookTarget.lerpVectors(sunPosition, center, centering).lerp(localGroupCenter, groupFollow);
        camera.position.copy(direction).multiplyScalar(distance).add(lookTarget);

        north.set(0, 1, 0).applyQuaternion(galaxy.quaternion);
        up.copy(WORLD_UP).lerp(north, tilt).normalize();
        // Di tahap Grup Lokal kamera diputar di sumbu pandangnya (roll) supaya sumbu panjang Grup Lokal
        // sejajar sisi layar yang panjang: mendatar di landscape, tegak di portrait. Tanpa ini galaksinya
        // bisa berjajar tegak di layar lebar dan Bima Sakti nempel ke judul di atas
        if (groupBlend > 0) {
          viewDirection.subVectors(lookTarget, camera.position).normalize();
          groupUp.copy(localGroupAxis).addScaledVector(viewDirection, -localGroupAxis.dot(viewDirection));
          if (groupUp.lengthSq() > 1e-6) {
            groupUp.normalize();
            if (mainCamera.aspect >= 1) groupUp.cross(viewDirection);
            if (groupUp.dot(up) < 0) groupUp.negate();
            up.lerp(groupUp, groupBlend).normalize();
          }
        }
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
      // Far plane selalu mencakup seluruh Grup Lokal (Andromeda kelihatan sebagai bercak kecil dari mana
      // pun). Gak ada objek galaxyScene yang menulis depth, jadi rentang near / far yang lebar gak masalah
      camera.far = distance + FAR_MARGIN + lookTarget.distanceTo(localGroupCenter) + localGroup.frameRadius;
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
        ringOpacity:
          fadeBetween(zoomLevel, STAGES.youAreHereRing.start, STAGES.youAreHereRing.end) *
          (1 - fadeBetween(zoomLevel, STAGES.youAreHereRingOut.start, STAGES.youAreHereRingOut.end)),
        elapsed,
        width: cssWidth,
        height: cssHeight
      });
      nearbyStars.update({
        camera,
        opacity:
          fadeBetween(zoomLevel, STAGES.nearbyStarsIn.start, STAGES.nearbyStarsIn.end) *
          (1 - fadeBetween(zoomLevel, STAGES.nearbyStarsOut.start, STAGES.nearbyStarsOut.end)),
        width: cssWidth,
        height: cssHeight
      });
      // Galaksi Grup Lokal muncul bareng partikel Bima Sakti (Awan Magellan dan Andromeda kelihatan juga
      // dari dalam piringan), label dan kliknya baru di tahap Grup Lokal
      localGroup.update({
        camera,
        opacity: galaxyOpacity,
        halo: fadeBetween(zoomLevel, STAGES.localGroupHalo.start, STAGES.localGroupHalo.end),
        labels: fadeBetween(zoomLevel, STAGES.localGroupLabels.start, STAGES.localGroupLabels.end),
        delta,
        viewportHeight,
        width: cssWidth,
        height: cssHeight
      });
    }
  };
}
