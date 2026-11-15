import * as THREE from 'three';
import { createStarMaterial, MIN_POINT_SIZE, MAX_POINT_SIZE } from './galaxyShaders.js';

// Partikel galaksi dari Web Worker (workers/galaxyWorker.js)
//
// Generate cuma sekali, dan baru waktu dibutuhkan (lazy). Selama worker jalan halaman tetap
// responsif. Hasilnya satu THREE.Points per komponen (bulge, batang, lengan, piringan),
// semuanya pakai satu material bintang biar uniform-nya cukup diatur sekali

// Kecerahan dasar partikel. Dikalibrasi dari tampilan atas galaksi utuh di 1366x768 dengan
// REFERENCE_TOTAL partikel: lengan jelas, inti terang tapi gak melebar jadi putih semua
// (bloom diatur ulang di G3). Kalau partikelnya lebih sedikit (HP, desktop low), tiap partikel
// mewakili lebih banyak bintang, jadi kecerahannya dikali sebanding. Kecerahan galaksi
// secara keseluruhan sama di semua perangkat, cuma lebih kasar butirannya
const BRIGHTNESS = 0.9;
const REFERENCE_TOTAL = 500_000;
// Setelah data siap, galaksi muncul pelan pelan segini detik (bukan langsung nongol)
const APPEAR_SECONDS = 0.8;
const SEED = 20261115;

export function createGalaxyParticles({ pixelRatio }) {
  const group = new THREE.Group();
  group.name = 'galaxy-particles';
  group.visible = false;

  const material = createStarMaterial({ brightness: BRIGHTNESS, pixelRatio });
  const geometries = [];

  // idle -> generating -> ready (atau error)
  let state = 'idle';
  let appear = 0;
  let opacity = 0;
  // Angka buat laporan / debug: lama generate di worker, total sampai data diterima, dan
  // lama main thread bikin geometry
  const stats = { count: 0, workerMs: null, roundTripMs: null, buildMs: null };

  function build(components) {
    const start = performance.now();
    for (const c of components) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(c.position, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(c.color, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(c.size, 1));
      geometry.setAttribute('seed', new THREE.BufferAttribute(c.seed, 1));
      geometry.computeBoundingSphere();
      geometries.push(geometry);

      const points = new THREE.Points(geometry, material);
      points.name = `galaxy-${c.name}`;
      group.add(points);
      stats.count += c.count;
    }
    stats.buildMs = performance.now() - start;
  }

  // Mulai generate di worker. Aman dipanggil berkali kali, worker cuma dijalankan sekali
  function generate(total) {
    if (state !== 'idle') return;
    state = 'generating';
    const start = performance.now();
    const worker = new Worker(new URL('../workers/galaxyWorker.js', import.meta.url), {
      type: 'module'
    });
    worker.onmessage = ({ data }) => {
      stats.workerMs = data.ms;
      stats.roundTripMs = performance.now() - start;
      build(data.components);
      worker.terminate();
      material.uniforms.uBrightness.value = (BRIGHTNESS * REFERENCE_TOTAL) / total;
      state = 'ready';
    };
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      state = 'error';
    };
    worker.postMessage({ total, seed: SEED });
  }

  return {
    group,
    generate,
    stats,
    get state() {
      return state;
    },
    // 0 sampai 1 dari zoomLevel. Dikali transisi muncul setelah data siap
    setOpacity(alpha) {
      opacity = alpha;
    },
    setPixelRatio(ratio) {
      material.uniforms.uMinSize.value = MIN_POINT_SIZE * ratio;
      material.uniforms.uMaxSize.value = MAX_POINT_SIZE * ratio;
    },
    // camera = kamera galaksi, viewportHeight = tinggi drawing buffer dalam piksel device.
    // Posisi kamera diubah ke koordinat galaksi buat hitungan ekstinksi debu di shader
    update(delta, camera, viewportHeight) {
      group.updateWorldMatrix(true, false);
      group.worldToLocal(material.uniforms.uCameraLocal.value.copy(camera.position));
      if (state === 'ready') appear = Math.min(appear + delta / APPEAR_SECONDS, 1);
      const alpha = opacity * appear * appear * (3 - 2 * appear);
      material.uniforms.uOpacity.value = alpha;
      group.visible = alpha > 0;
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      material.uniforms.uPixelScale.value = viewportHeight / (2 * tanHalfFov);
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      material.dispose();
    }
  };
}
